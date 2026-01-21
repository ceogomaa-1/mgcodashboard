import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const url = new URL(req.url)

  const code = url.searchParams.get('code')
  const role = (url.searchParams.get('role') || '').toUpperCase()
  const next = url.searchParams.get('next') || ''

  const techopsRedirect = next || '/techops/dashboard'
  const clientRedirect = next || '/client/dashboard'

  try {
    const supabase = await createClient()

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        const dest =
          role === 'TECHOPS'
            ? `/techops/login?error=${encodeURIComponent(error.message)}`
            : `/client/login?error=${encodeURIComponent(error.message)}`
        return NextResponse.redirect(new URL(dest, url.origin))
      }
    }

    const { data } = await supabase.auth.getSession()
    if (!data?.session) {
      const dest = role === 'TECHOPS' ? '/techops/login' : '/client/login'
      return NextResponse.redirect(new URL(dest, url.origin))
    }

    if (role === 'TECHOPS') return NextResponse.redirect(new URL(techopsRedirect, url.origin))
    if (role === 'CLIENT') return NextResponse.redirect(new URL(clientRedirect, url.origin))

    // If role missing, send somewhere safe
    return NextResponse.redirect(new URL('/', url.origin))
  } catch (e: any) {
    const msg = encodeURIComponent(e?.message || 'Auth callback failed')
    return NextResponse.redirect(new URL(`/techops/login?error=${msg}`, url.origin))
  }
}
