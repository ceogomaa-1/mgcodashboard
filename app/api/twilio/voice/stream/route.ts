import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendCallEvent } from "@/lib/ai-agent/calendar-tools";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "WebSocket upgrade is required. For production bridging (Twilio Media Streams <-> OpenAI Realtime), deploy this endpoint behind a Node websocket server.",
    },
    { status: 426 }
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const callSid = body?.callSid ? String(body.callSid) : null;
  const eventType = body?.eventType ? String(body.eventType) : null;

  if (!callSid || !eventType) {
    return NextResponse.json({ error: "callSid and eventType are required" }, { status: 400 });
  }

  const { data: call, error } = await supabaseAdmin
    .from("calls")
    .select("id,client_id")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!call) return NextResponse.json({ ok: true, ignored: true });

  const updates: Record<string, unknown> = {};
  if (typeof body?.transcript === "string") updates.transcript = body.transcript;
  if (typeof body?.summary === "string") updates.summary = body.summary;
  if (typeof body?.outcome === "string") updates.outcome = body.outcome;

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("calls").update(updates).eq("id", call.id);
  }

  await appendCallEvent({
    callId: call.id,
    clientId: call.client_id,
    type: eventType === "error" ? "error" : "agent_said",
    payload: body,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
