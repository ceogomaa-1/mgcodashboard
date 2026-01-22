import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const clientId = params.id

  const { error } = await supabaseAdmin
    .from('integrations')
    .upsert(
      {
        client_id: clientId,
        google_calendar_connected: false,
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_id: null,
        google_calendar_email: null,
      },
      { onConflict: 'client_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
