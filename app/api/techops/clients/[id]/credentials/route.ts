// app/api/techops/clients/[id]/credentials/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonErr(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  if (!clientId) return jsonErr("Missing client id");

  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select(
      `
      client_id,
      retell_account_email,
      retell_account_password,
      automation_tools_email,
      automation_tools_password,
      google_credentials_email,
      google_credentials_password
    `
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, credentials: data ?? null }, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  if (!clientId) return jsonErr("Missing client id");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON body");
  }

  // Only allow these fields (ignore anything else)
  const payload = {
    retell_account_email: body.retell_account_email ?? null,
    retell_account_password: body.retell_account_password ?? null,
    automation_tools_email: body.automation_tools_email ?? null,
    automation_tools_password: body.automation_tools_password ?? null,
    google_credentials_email: body.google_credentials_email ?? null,
    google_credentials_password: body.google_credentials_password ?? null,
  };

  // Ensure integrations row exists, then update it
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("integrations")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });

  if (existing?.client_id) {
    const { error: updErr } = await supabaseAdmin
      .from("integrations")
      .update(payload)
      .eq("client_id", clientId);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  } else {
    const { error: insErr } = await supabaseAdmin
      .from("integrations")
      .insert({ client_id: clientId, ...payload });

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// Some parts of apps call PATCH — keep it as alias.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return POST(req, ctx);
}
