import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  bookAppointment,
  cancelAppointment,
  checkAvailability,
  rescheduleAppointment,
} from "@/lib/ai-agent/calendar-tools";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const callSid = body?.callSid ? String(body.callSid) : "";
  const tool = body?.tool ? String(body.tool) : "";
  const args = body?.args && typeof body.args === "object" ? body.args : {};

  if (!callSid || !tool) {
    return NextResponse.json({ error: "callSid and tool are required" }, { status: 400 });
  }

  const { data: call, error } = await supabaseAdmin
    .from("calls")
    .select("id,client_id")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  try {
    if (tool === "check_availability") {
      const result = await checkAvailability({
        callId: call.id,
        clientId: call.client_id,
        startRange: String((args as Record<string, unknown>).start_range || ""),
        endRange: String((args as Record<string, unknown>).end_range || ""),
        durationMinutes: Number((args as Record<string, unknown>).duration_minutes || 30),
        timezone: String((args as Record<string, unknown>).timezone || "UTC"),
      });
      return NextResponse.json({ result });
    }

    if (tool === "book_appointment") {
      const result = await bookAppointment({
        callId: call.id,
        clientId: call.client_id,
        startIso: String((args as Record<string, unknown>).start_iso || ""),
        endIso: String((args as Record<string, unknown>).end_iso || ""),
        title: String((args as Record<string, unknown>).title || "Appointment"),
        description: String((args as Record<string, unknown>).description || ""),
        attendeeEmails: Array.isArray((args as Record<string, unknown>).attendee_emails)
          ? ((args as Record<string, unknown>).attendee_emails as string[])
          : [],
      });
      return NextResponse.json({ result });
    }

    if (tool === "cancel_appointment") {
      const result = await cancelAppointment({
        callId: call.id,
        clientId: call.client_id,
        eventId: String((args as Record<string, unknown>).event_id || ""),
      });
      return NextResponse.json({ result });
    }

    if (tool === "reschedule_appointment") {
      const result = await rescheduleAppointment({
        callId: call.id,
        clientId: call.client_id,
        eventId: String((args as Record<string, unknown>).event_id || ""),
        newStartIso: String((args as Record<string, unknown>).new_start_iso || ""),
        newEndIso: String((args as Record<string, unknown>).new_end_iso || ""),
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  } catch (toolError: unknown) {
    const message = toolError instanceof Error ? toolError.message : "Tool call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
