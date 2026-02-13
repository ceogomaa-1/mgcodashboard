import { Buffer } from "node:buffer";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CallEventType, CallOutcome } from "@/lib/ai-agent/types";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

type CalendarConnection = {
  id: string;
  client_id: string;
  google_email: string | null;
  refresh_token: string;
  access_token: string | null;
  token_expiry: string | null;
  scope: string | null;
};

function buildOauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL;

  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error("Missing Google OAuth env vars");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}

export function buildGoogleOAuthStartUrl(clientId: string) {
  const oauth2 = buildOauthClient();

  const payload = JSON.stringify({
    client_id: clientId,
    ts: Date.now(),
  });

  const state = Buffer.from(payload).toString("base64url");

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [CALENDAR_SCOPE],
    state,
  });
}

export function parseGoogleOAuthState(state: string | null) {
  if (!state) return null;

  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { client_id?: string };
    if (!parsed.client_id) return null;
    return parsed.client_id;
  } catch {
    return null;
  }
}

export async function saveGoogleOAuthTokens(args: {
  clientId: string;
  code: string;
}) {
  const oauth2 = buildOauthClient();
  const tokenResponse = await oauth2.getToken(args.code);
  const tokens = tokenResponse.tokens;

  const { data: existing } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("refresh_token")
    .eq("client_id", args.clientId)
    .maybeSingle();

  const refreshToken = tokens.refresh_token || existing?.refresh_token;
  if (!refreshToken) {
    throw new Error("Google refresh token missing; reconnect with consent prompt");
  }

  oauth2.setCredentials({
    access_token: tokens.access_token || undefined,
    refresh_token: refreshToken,
  });

  const oauthUserInfo = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();

  const { error } = await supabaseAdmin.from("google_calendar_connections").upsert(
    {
      client_id: args.clientId,
      google_email: oauthUserInfo.data.email || null,
      refresh_token: refreshToken,
      access_token: tokens.access_token || null,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: tokens.scope || CALENDAR_SCOPE,
    },
    { onConflict: "client_id" }
  );

  if (error) throw new Error(error.message);
}

async function getConnection(clientId: string): Promise<CalendarConnection> {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("id,client_id,google_email,refresh_token,access_token,token_expiry,scope")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Google Calendar not connected for this client");
  return data as CalendarConnection;
}

async function getCalendarClient(clientId: string) {
  const connection = await getConnection(clientId);
  const oauth2 = buildOauthClient();
  oauth2.setCredentials({
    access_token: connection.access_token || undefined,
    refresh_token: connection.refresh_token,
    expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined,
  });

  const { token } = await oauth2.getAccessToken();

  if (token && token !== connection.access_token) {
    await supabaseAdmin
      .from("google_calendar_connections")
      .update({ access_token: token, updated_at: new Date().toISOString() })
      .eq("client_id", clientId);
  }

  return google.calendar({ version: "v3", auth: oauth2 });
}

export async function appendCallEvent(args: {
  callId: string;
  clientId: string;
  type: CallEventType;
  payload: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("call_events").insert({
    call_id: args.callId,
    client_id: args.clientId,
    type: args.type,
    payload: args.payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function updateCallOutcome(callId: string, outcome: CallOutcome) {
  const { error } = await supabaseAdmin.from("calls").update({ outcome }).eq("id", callId);
  if (error) throw new Error(error.message);
}

export async function checkAvailability(args: {
  callId: string;
  clientId: string;
  startRange: string;
  endRange: string;
  durationMinutes: number;
  timezone: string;
}) {
  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_called",
    payload: { tool: "check_availability", args },
  });

  const calendar = await getCalendarClient(args.clientId);
  const busy = await calendar.freebusy.query({
    requestBody: {
      timeMin: args.startRange,
      timeMax: args.endRange,
      timeZone: args.timezone,
      items: [{ id: "primary" }],
    },
  });

  const payload = {
    busy: busy.data.calendars?.primary?.busy || [],
    duration_minutes: args.durationMinutes,
  };

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_result",
    payload: { tool: "check_availability", result: payload },
  });

  return payload;
}

export async function bookAppointment(args: {
  callId: string;
  clientId: string;
  startIso: string;
  endIso: string;
  title: string;
  description?: string;
  attendeeEmails?: string[];
}) {
  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_called",
    payload: { tool: "book_appointment", args },
  });

  const calendar = await getCalendarClient(args.clientId);
  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: args.title,
      description: args.description || "",
      start: { dateTime: args.startIso },
      end: { dateTime: args.endIso },
      attendees: (args.attendeeEmails || []).map((email) => ({ email })),
    },
  });

  await updateCallOutcome(args.callId, "booked");

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "booking_created",
    payload: { event_id: response.data.id || null, html_link: response.data.htmlLink || null },
  });

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_result",
    payload: { tool: "book_appointment", result: { event_id: response.data.id || null, html_link: response.data.htmlLink || null } },
  });

  return response.data;
}

export async function cancelAppointment(args: {
  callId: string;
  clientId: string;
  eventId: string;
}) {
  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_called",
    payload: { tool: "cancel_appointment", args },
  });

  const calendar = await getCalendarClient(args.clientId);
  await calendar.events.delete({
    calendarId: "primary",
    eventId: args.eventId,
  });

  await updateCallOutcome(args.callId, "cancelled");

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "booking_cancelled",
    payload: { event_id: args.eventId },
  });

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_result",
    payload: { tool: "cancel_appointment", result: { ok: true, event_id: args.eventId } },
  });

  return { ok: true };
}

export async function rescheduleAppointment(args: {
  callId: string;
  clientId: string;
  eventId: string;
  newStartIso: string;
  newEndIso: string;
}) {
  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_called",
    payload: { tool: "reschedule_appointment", args },
  });

  const calendar = await getCalendarClient(args.clientId);
  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: args.eventId,
    requestBody: {
      start: { dateTime: args.newStartIso },
      end: { dateTime: args.newEndIso },
    },
  });

  await updateCallOutcome(args.callId, "rescheduled");

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "booking_rescheduled",
    payload: {
      event_id: args.eventId,
      new_start_iso: args.newStartIso,
      new_end_iso: args.newEndIso,
    },
  });

  await appendCallEvent({
    callId: args.callId,
    clientId: args.clientId,
    type: "tool_result",
    payload: {
      tool: "reschedule_appointment",
      result: { event_id: response.data.id || args.eventId, html_link: response.data.htmlLink || null },
    },
  });

  return response.data;
}
