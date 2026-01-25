import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id: clientId } = await params;
  if (!clientId) return jsonErr("Missing client id");

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("integrations")
    .select("id, client_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (selErr) return jsonErr(selErr.message, 500);

  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .insert({
        client_id: clientId,
        google_calendar_connected: false,
        google_calendar_embed_url: null,
      })
      .select("*")
      .single();

    if (error) return jsonErr(error.message, 500);
    return NextResponse.json({ ok: true, integration: data });
  }

  const { data, error } = await supabaseAdmin
    .from("integrations")
    .update({
      google_calendar_connected: false,
      google_calendar_embed_url: null,
    })
    .eq("client_id", clientId)
    .select("*")
    .single();

  if (error) return jsonErr(error.message, 500);
  return NextResponse.json({ ok: true, integration: data });
}
