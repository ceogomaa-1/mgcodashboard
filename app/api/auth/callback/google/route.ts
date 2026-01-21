import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // client_id
  const oauthError = url.searchParams.get('error');

  console.log('=== GOOGLE OAUTH CALLBACK ===');
  console.log('Code:', code ? 'Present' : 'Missing');
  console.log('State (Client ID):', state);
  console.log('Error:', oauthError);

  if (oauthError) {
    return NextResponse.redirect(`${origin}/client/dashboard?error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/client/dashboard?error=missing_params`);
  }

  try {
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      `${origin}/api/auth/callback/google`;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('Tokens received:', {
      access_token: tokens.access_token ? 'Present' : 'Missing',
      refresh_token: tokens.refresh_token ? 'Present' : 'Missing',
    });

    // Fetch calendar list + pick primary calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary);

    if (!primaryCalendar?.id) {
      console.log('ERROR: No primary calendar found!');
      return NextResponse.redirect(`${origin}/client/dashboard?error=no_primary_calendar`);
    }

    const supabase = await createClient();

    // If Google doesn't return refresh_token (very common after first consent),
    // keep the existing refresh token stored in DB.
    const { data: existing, error: checkError } = await supabase
      .from('integrations')
      .select('id, google_refresh_token')
      .eq('client_id', state)
      .maybeSingle();

    const refreshTokenToStore =
      tokens.refresh_token || existing?.google_refresh_token || null;

    const upsertPayload = {
      client_id: state,
      google_calendar_connected: true,
      google_calendar_id: primaryCalendar.id,
      google_calendar_email: primaryCalendar.id,
      google_access_token: tokens.access_token || null,
      google_refresh_token: refreshTokenToStore,
      updated_at: new Date().toISOString(),
    };

    if (!existing || checkError) {
      const { error: insertError } = await supabase
        .from('integrations')
        .insert({
          ...upsertPayload,
          retell_connected: false,
        });

      if (insertError) {
        console.log('ERROR: Failed to insert integration:', insertError.message);
        return NextResponse.redirect(`${origin}/client/dashboard?error=db_insert_failed`);
      }
    } else {
      const { error: updateError } = await supabase
        .from('integrations')
        .update(upsertPayload)
        .eq('client_id', state);

      if (updateError) {
        console.log('ERROR: Failed to update integration:', updateError.message);
        return NextResponse.redirect(`${origin}/client/dashboard?error=db_update_failed`);
      }
    }

    // Verify (optional but helpful)
    const { data: verified } = await supabase
      .from('integrations')
      .select('google_calendar_connected')
      .eq('client_id', state)
      .maybeSingle();

    if (!verified?.google_calendar_connected) {
      console.log('ERROR: Verification failed - calendar not connected');
      return NextResponse.redirect(`${origin}/client/dashboard?error=db_verify_failed`);
    }

    console.log('SUCCESS! Redirecting to dashboard...');
    return NextResponse.redirect(`${origin}/client/dashboard?success=calendar_connected`);
  } catch (err: any) {
    console.error('=== GOOGLE OAUTH ERROR ===');
    console.error('Error message:', err?.message);
    console.error('Error stack:', err?.stack);

    return NextResponse.redirect(
      `${origin}/client/dashboard?error=connection_failed&details=${encodeURIComponent(
        err?.message || 'unknown'
      )}`
    );
  }
}
