'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Integration = {
  google_calendar_connected: boolean
  google_calendar_email: string | null
  google_calendar_id: string | null
}

export default function CalendarIntegrationPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/techops/clients/${clientId}/integrations`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load integrations')
      setIntegration(json.integration)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function connect() {
    const returnTo = `/techops/clients/${clientId}/integrations/calendar`
    window.location.href = `/api/auth/google?clientId=${encodeURIComponent(clientId)}&returnTo=${encodeURIComponent(returnTo)}`
  }

  async function disconnect() {
    setError(null)
    const res = await fetch(`/api/techops/clients/${clientId}/integrations/calendar/disconnect`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setError(json?.error || 'Failed to disconnect')
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-semibold">Google Calendar</div>
            <div className="text-white/60">Connect via OAuth so events load in real-time.</div>
          </div>

          <button
            className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          {loading ? (
            <div className="text-white/60">Loading…</div>
          ) : error ? (
            <div className="text-red-300">{error}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Status</div>
                  <div className="text-white/70">
                    {integration?.google_calendar_connected ? 'Connected ✅' : 'Not connected ❌'}
                  </div>
                  {integration?.google_calendar_connected && (
                    <div className="mt-2 text-sm text-white/60">
                      <div>Email: {integration.google_calendar_email || '—'}</div>
                      <div>Calendar ID: {integration.google_calendar_id || 'primary'}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!integration?.google_calendar_connected ? (
                    <button
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      onClick={connect}
                    >
                      Connect (OAuth)
                    </button>
                  ) : (
                    <button
                      className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                      onClick={disconnect}
                    >
                      Disconnect
                    </button>
                  )}

                  <button
                    className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                    onClick={load}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-5 text-xs text-white/50">
                If you ever see <b>invalid_grant</b>, it means Google revoked the refresh token → just hit Disconnect, then Connect again.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
