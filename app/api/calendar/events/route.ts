// app/api/calendar/events/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!clientId || !start || !end) {
      return NextResponse.json(
        { error: "Missing clientId/start/end" },
        { status: 400 }
      );
    }

    const { data: integ, error: iErr } = await supabaseAdmin
      .from("integrations")
      .select(
        "google_calendar_connected,google_calendar_id,google_access_token,google_refresh_token"
      )
      .eq("client_id", clientId)
      .maybeSingle();

    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
    if (!integ) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    if (!integ.google_calendar_connected) {
      return NextResponse.json({ events: [], warning: "Calendar not connected" });
    }

    if (!integ.google_refresh_token) {
      return NextResponse.json(
        { error: "Missing refresh token. Reconnect Google Calendar.", code: "RECONNECT_REQUIRED" },
        { status: 401 }
      );
    }

    const clientIdEnv = process.env.GOOGLE_CLIENT_ID;
    const clientSecretEnv = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientIdEnv || !clientSecretEnv) {
      return NextResponse.json(
        { error: "Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in env" },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientIdEnv, clientSecretEnv);

    oauth2Client.setCredentials({
      access_token: integ.google_access_token || undefined,
      refresh_token: integ.google_refresh_token || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const calendarId = integ.google_calendar_id || "primary";

    let resp;
    try {
      resp = await calendar.events.list({
        calendarId,
        timeMin: start,
        timeMax: end,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500,
      });
    } catch (e: any) {
      const msg = String(e?.message || e);

      // This is the exact issue you're seeing: refresh token is invalid/revoked.
      if (msg.includes("invalid_grant")) {
        return NextResponse.json(
          { error: "Google token expired/revoked. Reconnect Google Calendar.", code: "RECONNECT_REQUIRED" },
          { status: 401 }
        );
      }

      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const events =
      (resp.data.items || []).map((ev) => ({
        id: ev.id,
        summary: ev.summary || "(No title)",
        start: ev.start?.dateTime || ev.start?.date,
        end: ev.end?.dateTime || ev.end?.date,
        location: ev.location || "",
        description: ev.description || "",
      })) ?? [];

    return NextResponse.json({ events, calendarId });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
