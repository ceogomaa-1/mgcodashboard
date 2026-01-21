import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1) Fetch clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select(
        `
        id,
        business_name,
        owner_email,
        industry,
        phone_number,
        address,
        city,
        state,
        zip_code,
        status,
        created_at
        `
      )
      .order("created_at", { ascending: false });

    if (clientsError) {
      return NextResponse.json(
        { error: clientsError.message },
        { status: 500 }
      );
    }

    // 2) Fetch integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from("integrations")
      .select(
        `
        id,
        retell_connected,
        google_calendar_connected
        `
      );

    if (integrationsError) {
      return NextResponse.json(
        { error: integrationsError.message },
        { status: 500 }
      );
    }

    // 3) Merge integrations into clients (IMPORTANT PART)
    const mergedClients = clients.map((client) => {
      const integration = integrations.find(
        (i) => i.id === client.id
      );

      return {
        ...client,
        retell_connected: integration?.retell_connected ?? false,
        google_calendar_connected:
          integration?.google_calendar_connected ?? false,
      };
    });

    return NextResponse.json(
      { clients: mergedClients },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Unknown error" },
      { status: 500 }
    );
  }
}
