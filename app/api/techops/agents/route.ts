import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTechOps } from "@/lib/auth/access";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const auth = await requireTechOps();
  if (!auth.ok) return bad(auth.error, auth.status);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const industry = searchParams.get("industry");

  let query = supabaseAdmin
    .from("agents")
    .select(
      "id,name,industry,prompt,model,voice,twilio_phone_number,twilio_phone_number_sid,status,client_id,created_by_user_id,created_at,updated_at,clients(id,business_name,owner_email),calls(started_at)",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (industry) query = query.ilike("industry", industry);

  const { data, error, count } = await query;
  if (error) return bad(error.message, 500);

  const rows = (data || []).map((agent: { calls?: { started_at?: string | null }[] } & Record<string, unknown>) => {
    const callTimes = Array.isArray(agent.calls)
      ? agent.calls
          .map((entry) => entry.started_at)
          .filter(Boolean)
          .sort((a, b) => +new Date(String(b)) - +new Date(String(a)))
      : [];

    return {
      ...agent,
      last_call_at: callTimes[0] || null,
      calls: undefined,
    };
  });

  return NextResponse.json({ agents: rows, total: count || rows.length });
}

export async function POST(req: Request) {
  const auth = await requireTechOps();
  if (!auth.ok) return bad(auth.error, auth.status);

  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON body");

  const name = String(body.name || "").trim();
  const industry = String(body.industry || "").trim();
  const prompt = String(body.prompt || "").trim();
  const model = String(body.model || "").trim();
  const voice = String(body.voice || "").trim();
  const twilioPhoneNumber = String(body.twilio_phone_number || "").trim();
  const twilioPhoneNumberSid = body.twilio_phone_number_sid
    ? String(body.twilio_phone_number_sid)
    : null;
  const clientId = body.client_id ? String(body.client_id) : null;

  if (!name || !industry || !prompt || !model || !voice || !twilioPhoneNumber) {
    return bad("name, industry, prompt, model, voice and twilio_phone_number are required");
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .insert({
      name,
      industry,
      prompt,
      model,
      voice,
      twilio_phone_number: twilioPhoneNumber,
      twilio_phone_number_sid: twilioPhoneNumberSid,
      client_id: clientId,
      status: "draft",
      created_by_user_id: auth.auth.userId,
    })
    .select("*")
    .single();

  if (error) return bad(error.message, 500);

  return NextResponse.json({ agent: data }, { status: 201 });
}
