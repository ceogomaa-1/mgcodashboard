import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientByAuthEmail } from "@/lib/auth/access";

export async function GET(req: Request) {
  const auth = await getClientByAuthEmail();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const callId = searchParams.get("call_id");

  if (!callId) {
    return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("call_events")
    .select("id,call_id,client_id,type,payload,created_at")
    .eq("client_id", auth.client.id)
    .eq("call_id", callId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}
