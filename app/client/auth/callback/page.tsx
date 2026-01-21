'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ClientAuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const code = searchParams.get('code')

        // If Supabase returned an error in query params:
        const errDesc =
          searchParams.get('error_description') || searchParams.get('error') || null
        if (errDesc) throw new Error(errDesc)

        // Exchange PKCE code for session (THIS is what fixes the loop)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }

        // If already has a session, go dashboard
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          router.replace('/client/dashboard')
          return
        }

        // No session? Back to login
        router.replace('/client/login')
      } catch (e: any) {
        setError(e?.message || 'Authentication failed')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-semibold">Authenticating…</div>
        <div className="text-white/60 mt-2">Finishing login, one moment.</div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
