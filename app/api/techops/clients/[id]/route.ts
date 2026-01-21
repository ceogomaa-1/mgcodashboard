import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await ctx.params

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client id' }, { status: 400 })
    }

    const supabase = await createClient()

    // delete related rows first (unless you use FK cascade in Supabase)
    await supabase.from('client_integrations').delete().eq('client_id', clientId)
    await supabase.from('client_retell_agents').delete().eq('client_id', clientId)

    const { error } = await supabase.from('clients').delete().eq('id', clientId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
