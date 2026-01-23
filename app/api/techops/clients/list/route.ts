// app/api/techops/clients/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  // 1) Load clients (ONLY select columns that actually exist)
  const { data: clients, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("id,name,email,industry,status,created_at")
    .order("created_at", { ascending: false });

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const clientIds = (clients ?? [])
    .map((c: any) => c?.id)
    .filter(Boolean) as string[];

  // 2) Load integrations for those clients
  const { data: integrations, error: iErr } = await supabaseAdmin
    .from("integrations")
    .select(
      "client_id,retell_connected,google_calendar_connected,google_calendar_embed_url"
    )
    .in("client_id", clientIds);

  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  const integMap = new Map<string, any>();
  (integrations ?? []).forEach((row: any) => integMap.set(row.client_id, row));

  // 3) Normalize final payload (NO undefined ids)
  const result = (clients ?? []).map((c: any) => {
    const integ = integMap.get(c.id);

    const embedUrl = integ?.google_calendar_embed_url ?? null;
    const calendarConnected =
      Boolean(integ?.google_calendar_connected) || Boolean(embedUrl);

    return {
      id: c.id,
      name: c.name ?? null,
      email: c.email ?? null,
      industry: c.industry ?? null,
      status: c.status ?? null,
      created_at: c.created_at ?? null,

      calendar_connected: calendarConnected,
      retell_connected: Boolean(integ?.retell_connected),
      google_calendar_embed_url: embedUrl,
    };
  });

  return NextResponse.json({ clients: result }, { status: 200 });
}
