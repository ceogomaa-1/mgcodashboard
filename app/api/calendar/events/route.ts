// app/api/calendar/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!clientId || !start || !end) {
      return NextResponse.json({ error: "Missing clientId/start/end" }, { status: 400 });
    }

    // 1) Confirm logged-in user (so clients can't query other clients)
    const supabase = createClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const email = authData.user.email;

    // 2) Verify this user owns that clientId
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, owner_email")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if ((client.owner_email || "").toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Get integration row
    const { data: integ, error: integErr } = await supabaseAdmin
      .from("integrations")
      .select("google_calendar_connected, google_calendar_id, google_access_token, google_refresh_token")
      .eq("client_id", clientId)
      .single();

    if (integErr || !integ) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (!integ.google_calendar_connected || !integ.google_access_token) {
      return NextResponse.json({ error: "Calendar not connected" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: integ.google_access_token,
      refresh_token: integ.google_refresh_token || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 4) Pull events (Google will refresh token IF refresh_token is valid)
    let eventsResp;
    try {
      eventsResp = await calendar.events.list({
        calendarId: integ.google_calendar_id || "primary",
        timeMin: new Date(start).toISOString(),
        timeMax: new Date(end).toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500,
      });
    } catch (e: any) {
      // If refresh_token is missing/invalid -> user must reconnect.
      const msg = e?.response?.data?.error ?? e?.message ?? "Google error";
      return NextResponse.json(
        {
          error: "google_calendar_error",
          details: msg,
          fix:
            "Reconnect Google Calendar from TechOps → Calendar → Connect (it will re-issue a fresh refresh_token).",
        },
        { status: 401 }
      );
    }

    // 5) Save refreshed tokens if Google rotated them
    const creds = oauth2Client.credentials;
    if (creds?.access_token && creds.access_token !== integ.google_access_token) {
      await supabaseAdmin
        .from("integrations")
        .update({
          google_access_token: creds.access_token,
          // refresh_token usually only appears on first consent; keep old if absent
          google_refresh_token: creds.refresh_token ?? integ.google_refresh_token,
        })
        .eq("client_id", clientId);
    }

    const items = eventsResp?.data?.items ?? [];
    const cleaned = items.map((ev: any) => ({
      id: ev.id,
      summary: ev.summary || "(No title)",
      description: ev.description || "",
      location: ev.location || "",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
    }));

    return NextResponse.json({ events: cleaned });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
