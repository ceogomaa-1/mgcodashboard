import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTechOps } from "@/lib/auth/access";

export async function GET(req: Request) {
  const auth = await requireTechOps();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("id,client_id,google_email,token_expiry,scope,created_at,updated_at")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connection: data || null });
}
