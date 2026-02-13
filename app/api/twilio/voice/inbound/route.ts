import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allowAgentCall } from "@/lib/ai-agent/rate-limit";
import { appendCallEvent } from "@/lib/ai-agent/calendar-tools";
import { escapeXml, toTwiml } from "@/lib/twilio/api";

export const dynamic = "force-dynamic";

type TwilioForm = {
  CallSid: string;
  CallStatus: string;
  From: string;
  To: string;
};

function normalizeNumber(value: string) {
  return value.trim().replaceAll(" ", "");
}

function fallbackTwiml(message: string) {
  return toTwiml([`<Say>${escapeXml(message)}</Say>`, "<Hangup/>"]);
}

function xmlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const payload = {
      CallSid: String(form.get("CallSid") || ""),
      CallStatus: String(form.get("CallStatus") || ""),
      From: String(form.get("From") || ""),
      To: String(form.get("To") || ""),
    } satisfies TwilioForm;

    if (!payload.CallSid || !payload.To) {
      return xmlResponse(fallbackTwiml("We cannot process your call right now. Please try again."));
    }

    const inboundTo = normalizeNumber(payload.To);

    const { data: agent, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("id,client_id,name,status,prompt,model,voice,twilio_phone_number")
      .eq("twilio_phone_number", inboundTo)
      .maybeSingle();

    if (agentError) {
      return xmlResponse(fallbackTwiml("We are having technical difficulties. Please call again later."));
    }

    if (!agent || agent.status !== "published" || !agent.client_id) {
      return xmlResponse(fallbackTwiml("This line is not active yet. Please call back shortly."));
    }

    if (!allowAgentCall(agent.id)) {
      return xmlResponse(fallbackTwiml("We are handling high call volume. Please try again in a minute."));
    }

    const startedAt = new Date().toISOString();

    const { data: callRow, error: callError } = await supabaseAdmin
      .from("calls")
      .upsert(
        {
          agent_id: agent.id,
          client_id: agent.client_id,
          twilio_call_sid: payload.CallSid,
          from_number: payload.From || null,
          to_number: inboundTo,
          started_at: startedAt,
          outcome: "other",
        },
        { onConflict: "twilio_call_sid" }
      )
      .select("id")
      .single();

    if (callError || !callRow) {
      return xmlResponse(fallbackTwiml("We cannot connect your call right now. Please try again later."));
    }

    await appendCallEvent({
      callId: callRow.id,
      clientId: agent.client_id,
      type: "audio_started",
      payload: {
        call_sid: payload.CallSid,
        from_number: payload.From,
        to_number: inboundTo,
        call_status: payload.CallStatus,
      },
    }).catch(() => null);

    const publicBase = process.env.TWILIO_WEBHOOK_BASE_URL;
    if (!publicBase) {
      return xmlResponse(fallbackTwiml("Voice service is not configured. Please call later."));
    }

    const streamUrl = `${publicBase.replace(/\/$/, "")}/api/twilio/voice/stream?callSid=${encodeURIComponent(
      payload.CallSid
    )}&agentId=${encodeURIComponent(agent.id)}&callId=${encodeURIComponent(callRow.id)}`;

    const statusCallback = `${publicBase.replace(/\/$/, "")}/api/twilio/voice/stream/status`;

    const twiml = toTwiml([
      `<Connect><Stream url="${escapeXml(streamUrl)}" statusCallback="${escapeXml(
        statusCallback
      )}" statusCallbackMethod="POST" /></Connect>`,
      "<Pause length=\"60\"/>",
      "<Say>Thanks for calling. Goodbye.</Say>",
      "<Hangup/>",
    ]);

    return xmlResponse(twiml);
  } catch {
    return xmlResponse(fallbackTwiml("We cannot process your call right now. Please try again."));
  }
}
