import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTechOps } from "@/lib/auth/access";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTechOps();
  if ("error" in auth) return bad(auth.error, auth.status);

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select(
      "id,name,industry,prompt,model,voice,twilio_phone_number,twilio_phone_number_sid,status,client_id,created_by_user_id,created_at,updated_at,clients(id,business_name,owner_email)"
    )
    .eq("id", id)
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ agent: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTechOps();
  if ("error" in auth) return bad(auth.error, auth.status);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON body");

  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.industry === "string") updates.industry = body.industry.trim();
  if (typeof body.prompt === "string") updates.prompt = body.prompt;
  if (typeof body.model === "string") updates.model = body.model;
  if (typeof body.voice === "string") updates.voice = body.voice;
  if (typeof body.twilio_phone_number === "string") updates.twilio_phone_number = body.twilio_phone_number;
  if (typeof body.twilio_phone_number_sid === "string" || body.twilio_phone_number_sid === null) {
    updates.twilio_phone_number_sid = body.twilio_phone_number_sid;
  }

  if (Object.keys(updates).length === 0) {
    return bad("No mutable fields supplied");
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ agent: data });
}
