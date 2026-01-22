// app/api/techops/clients/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { data: clients, error: clientsErr } = await supabaseAdmin
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (clientsErr) {
      return NextResponse.json({ error: clientsErr.message }, { status: 500 });
    }

    const clientIds = (clients ?? []).map((c: any) => c.id);
    const { data: integrations, error: integErr } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .in("client_id", clientIds);

    if (integErr) {
      return NextResponse.json({ error: integErr.message }, { status: 500 });
    }

    const integByClientId = new Map<string, any>();
    (integrations ?? []).forEach((i: any) => integByClientId.set(i.client_id, i));

    const merged = (clients ?? []).map((c: any) => {
      const i = integByClientId.get(c.id);
      return {
        ...c,
        integrations: {
          retell_connected: !!i?.retell_connected,
          google_calendar_connected: !!i?.google_calendar_connected,
          google_calendar_id: i?.google_calendar_id ?? null,
        },
      };
    });

    return NextResponse.json({ clients: merged });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
