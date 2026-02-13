import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const callSid = body?.callSid ? String(body.callSid) : "";

  if (!callSid) {
    return NextResponse.json({ error: "callSid is required" }, { status: 400 });
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const { data: call, error: callError } = await supabaseAdmin
    .from("calls")
    .select("id,agent_id,client_id")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  if (callError) {
    return NextResponse.json({ error: callError.message }, { status: 500 });
  }

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const { data: agent, error: agentError } = await supabaseAdmin
    .from("agents")
    .select("id,prompt,model,voice")
    .eq("id", call.agent_id)
    .maybeSingle();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: agent.model,
      voice: agent.voice,
      instructions: agent.prompt,
      tools: [
        {
          type: "function",
          name: "check_availability",
          description: "Check available windows in Google Calendar",
          parameters: {
            type: "object",
            properties: {
              start_range: { type: "string" },
              end_range: { type: "string" },
              duration_minutes: { type: "number" },
              timezone: { type: "string" },
            },
            required: ["start_range", "end_range", "duration_minutes", "timezone"],
          },
        },
        {
          type: "function",
          name: "book_appointment",
          description: "Book a new appointment in Google Calendar",
          parameters: {
            type: "object",
            properties: {
              start_iso: { type: "string" },
              end_iso: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              attendee_emails: { type: "array", items: { type: "string" } },
            },
            required: ["start_iso", "end_iso", "title"],
          },
        },
        {
          type: "function",
          name: "cancel_appointment",
          description: "Cancel an appointment in Google Calendar",
          parameters: {
            type: "object",
            properties: {
              event_id: { type: "string" },
            },
            required: ["event_id"],
          },
        },
        {
          type: "function",
          name: "reschedule_appointment",
          description: "Reschedule an existing appointment",
          parameters: {
            type: "object",
            properties: {
              event_id: { type: "string" },
              new_start_iso: { type: "string" },
              new_end_iso: { type: "string" },
            },
            required: ["event_id", "new_start_iso", "new_end_iso"],
          },
        },
      ],
      metadata: {
        call_id: call.id,
        agent_id: call.agent_id,
        client_id: call.client_id,
      },
    }),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to create realtime session", details: json },
      { status: 500 }
    );
  }

  return NextResponse.json({ session: json });
}
