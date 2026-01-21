import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const errorDesc = url.searchParams.get('error_description')

  if (error) {
    return NextResponse.redirect(
      new URL(`/client/login?error=${encodeURIComponent(errorDesc || error)}`, url.origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/client/login?error=Missing+code', url.origin))
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/client/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin)
    )
  }

  return NextResponse.redirect(new URL('/client/dashboard', url.origin))
}
