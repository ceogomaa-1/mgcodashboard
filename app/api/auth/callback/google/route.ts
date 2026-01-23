import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // clientId
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // ✅ pull existing integration so we do NOT wipe refresh_token if Google doesn't resend it
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("integrations")
      .select("google_refresh_token, google_calendar_id")
      .eq("client_id", state)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    const refreshToStore =
      tokens.refresh_token ?? existing?.google_refresh_token ?? null;

    const calendarIdToStore =
      existing?.google_calendar_id ??
      "primary";

    const { error } = await supabaseAdmin
      .from("integrations")
      .upsert(
        {
          client_id: state,
          google_calendar_connected: true,
          google_calendar_id: calendarIdToStore,
          google_access_token: tokens.access_token ?? null,
          google_refresh_token: refreshToStore, // ✅ keep old if not provided
          google_token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          google_last_synced_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // back to TechOps client calendar screen
    return NextResponse.redirect(
      new URL(`/techops/clients/${state}/integrations/calendar`, req.url)
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "OAuth failed" }, { status: 500 });
  }
}
