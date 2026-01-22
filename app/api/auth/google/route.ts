// app/api/auth/google/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. http://localhost:3000/api/auth/callback/google
  );

  const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // <-- CRITICAL: forces refresh_token issuance
    scope: scopes,
    state: clientId,
  });

  return NextResponse.redirect(url);
}
