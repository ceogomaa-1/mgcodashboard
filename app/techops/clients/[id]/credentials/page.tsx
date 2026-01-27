// app/api/techops/clients/[id]/credentials/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function clean(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  if (!clientId) return bad("Missing client id");

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const payload = {
      retell_account_email: clean(body.retell_account_email),
      retell_account_password: clean(body.retell_account_password),
      automation_tools_email: clean(body.automation_tools_email),
      automation_tools_password: clean(body.automation_tools_password),
      google_credentials_email: clean(body.google_credentials_email),
      google_credentials_password: clean(body.google_credentials_password),
    };

    // Ensure there is exactly one integrations row per client
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("integrations")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (selErr) return bad(selErr.message, 400);

    if (existing?.id) {
      const { error: updErr } = await supabaseAdmin
        .from("integrations")
        .update(payload)
        .eq("client_id", clientId);

      if (updErr) return bad(updErr.message, 400);
    } else {
      const { error: insErr } = await supabaseAdmin
        .from("integrations")
        .insert({ client_id: clientId, ...payload });

      if (insErr) return bad(insErr.message, 400);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
