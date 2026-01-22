// app/api/techops/clients/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;

    // 1) Delete integrations row(s) for that client
    const { error: integErr } = await supabaseAdmin
      .from("integrations")
      .delete()
      .eq("client_id", clientId);

    if (integErr) {
      return NextResponse.json({ error: integErr.message }, { status: 500 });
    }

    // 2) Delete the client
    const { error: clientErr } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (clientErr) {
      return NextResponse.json({ error: clientErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
