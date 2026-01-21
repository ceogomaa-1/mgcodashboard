'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ClientLoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loginWithGoogle() {
    setLoading(true)
    setError(null)

    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL

      if (!origin) throw new Error('Missing site URL (window.location.origin unavailable)')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/client/auth/callback`,
        },
      })

      if (error) throw error
      // user will be redirected by Supabase
    } catch (e: any) {
      setError(e?.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-2xl font-semibold">Client Login</div>
        <div className="text-white/60 mt-2">
          Sign in with Google to access your MG&CO Dashboard.
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-white text-black font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <button
          onClick={() => router.push('/')}
          className="mt-3 w-full px-4 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10"
        >
          Back
        </button>
      </div>
    </div>
  )
}
