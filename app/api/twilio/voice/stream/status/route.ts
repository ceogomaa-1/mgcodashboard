import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendCallEvent } from "@/lib/ai-agent/calendar-tools";

export const dynamic = "force-dynamic";

function asInt(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "Invalid form payload" }, { status: 400 });
  }

  const callSid = String(form.get("CallSid") || "");
  const streamEvent = String(form.get("StreamEvent") || "");
  const streamError = String(form.get("StreamError") || "");
  const callDurationSec = asInt(form.get("CallDuration"));

  if (!callSid) {
    return NextResponse.json({ ok: false, error: "Missing CallSid" }, { status: 400 });
  }

  const { data: call, error } = await supabaseAdmin
    .from("calls")
    .select("id,client_id,started_at,outcome")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!call) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const endedAt = new Date();
  const startedAt = call.started_at ? new Date(call.started_at) : null;

  const duration =
    callDurationSec ??
    (startedAt ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)) : null);

  const updates: Record<string, unknown> = {
    ended_at: endedAt.toISOString(),
    duration_seconds: duration,
    summary: streamError
      ? "Call ended with stream error"
      : streamEvent === "stream-stopped"
      ? "Call completed"
      : null,
  };

  if (!call.outcome) {
    updates.outcome = streamError ? "error" : "hangup";
  }

  const { error: updateError } = await supabaseAdmin
    .from("calls")
    .update(updates)
    .eq("id", call.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await appendCallEvent({
    callId: call.id,
    clientId: call.client_id,
    type: streamError ? "error" : "call_ended",
    payload: {
      stream_event: streamEvent || null,
      stream_error: streamError || null,
      duration_seconds: duration,
      call_sid: callSid,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
