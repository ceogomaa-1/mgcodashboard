import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientByAuthEmail } from "@/lib/auth/access";

export async function GET() {
  const auth = await getClientByAuthEmail();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const clientId = auth.client.id;

  const [{ data: agents, error: agentsError }, { data: calls, error: callsError }] = await Promise.all([
    supabaseAdmin
      .from("agents")
      .select("id,name,industry,twilio_phone_number,status,created_at,updated_at")
      .eq("client_id", clientId)
      .eq("status", "published")
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("calls")
      .select("id,agent_id,client_id,from_number,to_number,started_at,ended_at,duration_seconds,outcome,transcript,summary,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (agentsError) {
    return NextResponse.json({ error: agentsError.message }, { status: 500 });
  }

  if (callsError) {
    return NextResponse.json({ error: callsError.message }, { status: 500 });
  }

  return NextResponse.json({ client_id: clientId, agents: agents || [], calls: calls || [] });
}
