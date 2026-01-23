// app/api/techops/clients/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const clientId = params?.id;

  if (!clientId || clientId === "undefined" || clientId === "null") {
    return bad("Missing client id (uuid). Refusing to delete.");
  }

  // 1) delete integrations first
  const { error: integErr } = await supabaseAdmin
    .from("integrations")
    .delete()
    .eq("client_id", clientId);

  if (integErr) {
    return NextResponse.json({ error: integErr.message }, { status: 500 });
  }

  // 2) delete client row
  const { error: clientErr } = await supabaseAdmin
    .from("clients")
    .delete()
    .eq("id", clientId);

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
