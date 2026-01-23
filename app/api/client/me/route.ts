// app/api/client/me/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  // user from cookies/session
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  const email = u?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // fetch client by email (admin avoids RLS issues)
  const { data: client, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("id,name,email,industry,status")
    .eq("email", email)
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
    .select("google_calendar_embed_url,google_calendar_connected,retell_connected")
    .eq("client_id", client.id)
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json(
    { client, integration: integ ?? null },
    { status: 200 }
  );
}
