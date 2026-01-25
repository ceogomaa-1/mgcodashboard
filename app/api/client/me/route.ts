// app/api/client/me/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  // IMPORTANT: createClient() is async in /lib/supabase/server.ts
  const supabase = await createClient();

  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 401 });
  }

  const email = u?.user?.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch client by email using admin (avoids RLS). Use ilike for case-insensitive exact match.
  const { data: client, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("id,name,email,industry,status")
    .ilike("email", email)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  if (!client) {
    return NextResponse.json(
      { error: `No client profile found for: ${email}` },
      { status: 404 }
    );
  }

  const { data: integ, error: iErr } = await supabaseAdmin
    .from("integrations")
    .select(
      "google_calendar_embed_url,google_calendar_connected,retell_connected,retell_phone_number,google_calendar_id"
    )
    .eq("client_id", client.id)
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json(
    { client, integration: integ ?? null, email },
    { status: 200 }
  );
}
