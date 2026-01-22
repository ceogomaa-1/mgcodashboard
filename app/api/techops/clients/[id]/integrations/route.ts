import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const clientId = params.id

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('google_calendar_connected, google_calendar_email, google_calendar_id')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    integration: data || {
      google_calendar_connected: false,
      google_calendar_email: null,
      google_calendar_id: null,
    },
  })
}
