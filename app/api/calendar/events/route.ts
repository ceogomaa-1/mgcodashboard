import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

function safeDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('google_access_token, google_refresh_token, google_calendar_id')
      .eq('client_id', clientId)
      .single()

    if (error || !integration?.google_access_token) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: integration.google_access_token,
      refresh_token: integration.google_refresh_token,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Default window: start of current week -> +30 days
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const defaultEnd = new Date(startOfWeek)
    defaultEnd.setDate(defaultEnd.getDate() + 30)

    const timeMin = safeDate(start, startOfWeek)
    const timeMax = safeDate(end, defaultEnd)

    const response = await calendar.events.list({
      calendarId: integration.google_calendar_id || 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    })

    return NextResponse.json(
      { events: response.data.items || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('Error fetching calendar events:', err)
    return NextResponse.json(
      { error: 'Failed to fetch events', details: err.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
