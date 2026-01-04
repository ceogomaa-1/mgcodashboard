import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Get integration with tokens
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('google_access_token, google_refresh_token, google_calendar_id')
      .eq('client_id', clientId)
      .single();

    if (error || !integration?.google_access_token) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    // Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: integration.google_access_token,
      refresh_token: integration.google_refresh_token,
    });

    // Fetch calendar events
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3); // Next 3 months

    const response = await calendar.events.list({
      calendarId: integration.google_calendar_id || 'primary',
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return NextResponse.json({ events: response.data.items || [] });
  } catch (err: any) {
    console.error('Error fetching calendar events:', err);
    return NextResponse.json({ error: 'Failed to fetch events', details: err.message }, { status: 500 });
  }
}