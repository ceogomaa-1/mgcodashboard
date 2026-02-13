import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RetellCall = {
  duration_ms?: number | null;
  latency?: any;
  disconnection_reason?: string | null;
  call_analysis?: any;
  call_cost?: any;
};

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseEpochMs(input: string | null, fallbackMs: number): number {
  if (!input) return fallbackMs;
  const n = Number(input);
  if (!Number.isFinite(n)) return fallbackMs;
  // Accept either seconds or milliseconds from callers.
  return n > 1e12 ? Math.floor(n) : Math.floor(n * 1000);
}

function pickSentiment(call: RetellCall): string {
  const ca = call.call_analysis || {};
  // Retell docs say call_analysis includes sentiment, but field name may vary.
  return (
    ca.user_sentiment ||
    ca.sentiment ||
    ca.overall_sentiment ||
    "unknown"
  );
}

function pickCallSuccessful(call: RetellCall): boolean {
  const ca = call.call_analysis || {};
  if (typeof ca.call_successful === "boolean") return ca.call_successful;
  // fallback if only status exists
  const st = (ca.call_status || ca.status || "").toString().toLowerCase();
  if (st.includes("success") || st.includes("completed")) return true;
  return false;
}

function pickLatencyMs(call: RetellCall): number | null {
  const l = call.latency || {};
  // fields vary depending on call type; we try common patterns
  const candidates = [
    l?.e2e?.average,
    l?.e2e?.p50,
    l?.average,
    l?.p50,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    const { data: integration, error: intErr } = await supabaseAdmin
      .from("integrations")
      .select("retell_connected, retell_api_key, retell_agent_id")
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();

    if (intErr) {
      return NextResponse.json({ error: intErr.message }, { status: 500 });
    }

    if (!integration?.retell_connected) {
      return NextResponse.json({ error: "Retell not connected" }, { status: 400 });
    }

    // Client-specific key only (no platform/master fallback).
    const apiKey = (
      (integration as any)?.retell_api_key ||
      ""
    )
      .toString()
      .trim();

    if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("key_")) {
      return NextResponse.json(
        { error: "Missing or invalid Retell API key in integrations.retell_api_key" },
        { status: 400 }
      );
    }

    // Default date range: last 30 days (like a typical analytics default)
    const now = Date.now();
    const startMs = parseEpochMs(searchParams.get("startMs"), now - 30 * 24 * 60 * 60 * 1000);
    const endMs = parseEpochMs(searchParams.get("endMs"), now);
    const startSec = Math.floor(startMs / 1000);
    const endSec = Math.floor(endMs / 1000);

    // Retell expects start_timestamp filter as OBJECT (thresholds), not a number.
    // See List Calls filter_criteria.start_timestamp. :contentReference[oaicite:2]{index=2}
    const calls: RetellCall[] = [];
    let paginationKey: string | undefined = undefined;

    // Pull up to ~1000 calls safely (10 pages * 100).
    for (let page = 0; page < 10; page++) {
      const body: any = {
        filter_criteria: {
          start_timestamp: {
            lower_threshold: startSec,
            upper_threshold: endSec,
          },
        },
        limit: 100,
      };
      if (paginationKey) body.pagination_key = paginationKey;

      const r = await fetch("https://api.retellai.com/v2/list-calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const details = await r.text();
        return NextResponse.json(
          { error: `Retell API error: ${r.status}`, details },
          { status: 500 }
        );
      }

      const json: any = await r.json();
      const batch: RetellCall[] = Array.isArray(json?.calls) ? json.calls : [];

      calls.push(...batch);

      // If fewer than limit, we’re done.
      if (batch.length < 100) break;

      // pagination_key is typically the last call_id in response.
      // If Retell returns a pagination_key directly, use it; otherwise fallback.
      paginationKey = json?.pagination_key || json?.next_pagination_key || undefined;

      // If no key is provided, stop to avoid infinite loop.
      if (!paginationKey) break;
    }

    const totalCalls = calls.length;

    let successful = 0;
    let totalDurationMs = 0;
    let latencySum = 0;
    let latencyCount = 0;

    const disconnectionReasons: Record<string, number> = {};
    const userSentiments: Record<string, number> = {};

    for (const c of calls) {
      if (pickCallSuccessful(c)) successful += 1;

      const dur = typeof c.duration_ms === "number" ? c.duration_ms : 0;
      totalDurationMs += dur;

      const lat = pickLatencyMs(c);
      if (lat !== null) {
        latencySum += lat;
        latencyCount += 1;
      }

      const reason = (c.disconnection_reason || "unknown").toString();
      disconnectionReasons[reason] = (disconnectionReasons[reason] || 0) + 1;

      const sent = pickSentiment(c).toString();
      userSentiments[sent] = (userSentiments[sent] || 0) + 1;
    }

    const unsuccessful = totalCalls - successful;
    const avgDurationSec = totalCalls ? totalDurationMs / 1000 / totalCalls : 0;
    const avgLatencyMs = latencyCount ? latencySum / latencyCount : null;

    return NextResponse.json({
      range: { startMs, endMs },
      totals: {
        totalCalls,
        successful,
        unsuccessful,
        avgDurationSec,
        totalDurationSec: totalDurationMs / 1000,
        avgLatencyMs,
      },
      breakdowns: {
        disconnectionReasons,
        userSentiments,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
