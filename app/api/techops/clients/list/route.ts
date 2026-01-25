import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ClientRow = {
  id: string;
  business_name: string | null;
  owner_email: string | null;
  industry: string | null;
  phone_number: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type IntegrationRow = {
  client_id: string;
  retell_connected: boolean | null;
  google_calendar_connected: boolean | null;
  google_calendar_embed_url: string | null;
  retell_agent_id: string | null;
  google_calendar_id: string | null;
};

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) get clients (CORRECT column names)
    const { data: clients, error: cErr } = await supabase
      .from("clients")
      .select(
        "id,business_name,owner_email,industry,phone_number,status,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const safeClients = (clients || []) as ClientRow[];
    const ids = safeClients.map((c) => c.id);

    // 2) get integrations for those clients
    let integrations: IntegrationRow[] = [];
    if (ids.length) {
      const { data: ints, error: iErr } = await supabase
        .from("integrations")
        .select(
          "client_id,retell_connected,google_calendar_connected,google_calendar_embed_url,retell_agent_id,google_calendar_id"
        )
        .in("client_id", ids);

      if (iErr) {
        return NextResponse.json({ error: iErr.message }, { status: 500 });
      }
      integrations = (ints || []) as IntegrationRow[];
    }

    const byClientId = new Map<string, IntegrationRow>();
    for (const row of integrations) byClientId.set(row.client_id, row);

    const merged = safeClients.map((c) => {
      const i = byClientId.get(c.id);
      return {
        ...c,
        integrations: {
          retell_connected: !!i?.retell_connected,
          google_calendar_connected: !!i?.google_calendar_connected,
          google_calendar_embed_url: i?.google_calendar_embed_url || null,
          retell_agent_id: i?.retell_agent_id || null,
          google_calendar_id: i?.google_calendar_id || null,
        },
      };
    });

    return NextResponse.json({ clients: merged });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
