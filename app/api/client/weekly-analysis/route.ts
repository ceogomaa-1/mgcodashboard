import { NextResponse } from "next/server";
import { getClientByAuthEmail } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getClientByAuthEmail();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("client_weekly_analyses")
    .select("id,client_id,week_start,week_end,report_file_name,status,analysis_json,created_at")
    .eq("client_id", auth.client.id)
    .eq("status", "ready")
    .order("week_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data ?? null }, { status: 200 });
}
