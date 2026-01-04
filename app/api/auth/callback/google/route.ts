import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('=== GOOGLE OAUTH CALLBACK ===');
  console.log('Code:', code ? 'Present' : 'Missing');
  console.log('State (Client ID):', state);
  console.log('Error:', error);

  if (error) {
    console.log('OAuth error - redirecting to dashboard');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/client/dashboard?error=access_denied`);
  }

  if (!code || !state) {
    console.log('Missing code or state - redirecting to dashboard');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/client/dashboard?error=missing_params`);
  }

  try {
    console.log('Creating OAuth2 client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('Tokens received:', {
      access_token: tokens.access_token ? 'Present' : 'Missing',
      refresh_token: tokens.refresh_token ? 'Present' : 'Missing'
    });

    console.log('Fetching calendar list...');
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find(cal => cal.primary);

    if (!primaryCalendar) {
      console.log('ERROR: No primary calendar found!');
      throw new Error('No primary calendar found');
    }

    console.log('Primary calendar found:', primaryCalendar.id);

    const supabase = await createClient();

    // Check if integration exists
    console.log('Checking for existing integration...');
    const { data: existing, error: checkError } = await supabase
      .from('integrations')
      .select('id, client_id')
      .eq('client_id', state)
      .single();

    console.log('Existing integration:', existing ? 'Found' : 'Not found');
    console.log('Check error:', checkError?.message);

    if (!existing) {
      // Create new integration row
      console.log('Creating new integration row...');
      const { data: inserted, error: insertError } = await supabase
        .from('integrations')
        .insert({
          client_id: state,
          google_calendar_connected: true,
          google_calendar_id: primaryCalendar.id,
          google_calendar_email: primaryCalendar.id,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          retell_connected: false,
        })
        .select()
        .single();

      console.log('Insert result:', inserted ? 'Success' : 'Failed');
      console.log('Insert error:', insertError?.message);

      if (insertError) {
        console.log('ERROR: Failed to insert integration!');
        throw insertError;
      }
    } else {
      // Update existing integration
      console.log('Updating existing integration...');
      const { data: updated, error: updateError } = await supabase
        .from('integrations')
        .update({
          google_calendar_connected: true,
          google_calendar_id: primaryCalendar.id,
          google_calendar_email: primaryCalendar.id,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', state)
        .select()
        .single();

      console.log('Update result:', updated ? 'Success' : 'Failed');
      console.log('Update error:', updateError?.message);

      if (updateError) {
        console.log('ERROR: Failed to update integration!');
        throw updateError;
      }
    }

    // Verify it worked
    console.log('Verifying database update...');
    const { data: verified, error: verifyError } = await supabase
      .from('integrations')
      .select('google_calendar_connected, google_calendar_id, google_access_token')
      .eq('client_id', state)
      .single();

    console.log('Verification result:', verified);
    console.log('Verify error:', verifyError?.message);

    if (!verified?.google_calendar_connected) {
      console.log('ERROR: Calendar not marked as connected after update!');
      throw new Error('Database verification failed - calendar not connected');
    }

    console.log('SUCCESS! Redirecting to dashboard...');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/client/dashboard?success=calendar_connected`);

  } catch (err: any) {
    console.error('=== GOOGLE OAUTH ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/client/dashboard?error=connection_failed&details=${encodeURIComponent(err.message)}`);
  }
}