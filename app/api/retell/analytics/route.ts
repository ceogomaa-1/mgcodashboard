import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function toTimestampSeconds(d: Date) {
  return { seconds: Math.floor(d.getTime() / 1000) };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    // Service-role Supabase (server only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // NOTE: You said you're pasting the Retell API key into TechOps.
    // Based on your screenshot, that "key_..." is currently saved in integrations.retell_agent_id.
    const { data: integ, error: integErr } = await supabase
      .from("integrations")
      .select("retell_connected, retell_agent_id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (integErr) {
      return NextResponse.json({ error: integErr.message }, { status: 500 });
    }

    if (!integ?.retell_connected) {
      return NextResponse.json({ error: "Retell not connected for this client." }, { status: 400 });
    }

    const apiKeyFromDb = (integ?.retell_agent_id || "").trim();
    const apiKey = apiKeyFromDb.startsWith("key_") ? apiKeyFromDb : "";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing Retell API key. (Right now this route expects it in integrations.retell_agent_id starting with 'key_'.)",
        },
        { status: 400 }
      );
    }

    // Date range: last 30 days (account-wide totals like Retell dashboard “All agents”)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    // ✅ CRITICAL FIX: start_timestamp / end_timestamp must be OBJECTS
    const body = {
      filter_criteria: {
        start_timestamp: toTimestampSeconds(start),
        end_timestamp: toTimestampSeconds(end),
      },
    };

    // Your project is already hitting Retell successfully (you got a Retell API error back),
    // so keep the same base if you already use it elsewhere; this is the standard.
    const retellRes = await fetch("https://api.retellai.com/v2/analytics", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await retellRes.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // keep as text if not JSON
    }

    if (!retellRes.ok) {
      return NextResponse.json(
        { error: `Retell API error: ${retellRes.status}`, details: json ?? text },
        { status: 400 }
      );
    }

    return NextResponse.json(json ?? {}, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
