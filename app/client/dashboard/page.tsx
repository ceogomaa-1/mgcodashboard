'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ClientRow = {
  id: string
  business_name: string | null
  owner_email: string | null
  industry: string | null
  phone: string | null
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
}

type IntegrationsRow = {
  client_id: string
  google_calendar_connected?: boolean | null
  retell_connected?: boolean | null
  google_calendar_id?: string | null
  retell_agent_id?: string | null
}

type GoogleEvent = {
  id?: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

type RetellPayload = {
  range: string
  summary: {
    totalCalls: number
    totalEnded: number
    avgDurationSec: number
    successRate: number
    sentiment: Record<string, number>
    disconnection: Record<string, number>
  }
  series: { date: string; calls: number; minutes: number }[]
  recentCalls: Array<{
    call_id: string
    call_status?: string
    start_timestamp?: number
    duration_ms?: number
    sentiment?: string
    successful?: boolean | null
    disconnection_reason?: string
  }>
}

function formatSec(sec: number) {
  if (!sec) return '0s'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (!m) return `${s}s`
  return `${m}m ${s}s`
}

export default function ClientDashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [client, setClient] = useState<ClientRow | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationsRow | null>(null)

  // Calendar state
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [events, setEvents] = useState<GoogleEvent[]>([])
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const ws = new Date(d)
    ws.setDate(d.getDate() - d.getDay())
    ws.setHours(0, 0, 0, 0)
    return ws
  })

  // Retell state
  const [retellLoading, setRetellLoading] = useState(false)
  const [retellError, setRetellError] = useState<string | null>(null)
  const [retellRange, setRetellRange] = useState<'7d' | '30d' | '90d' | '365d' | 'all'>('all')
  const [retell, setRetell] = useState<RetellPayload | null>(null)

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

  const hours = useMemo(() => Array.from({ length: 12 }).map((_, i) => i + 8), [])

  function eventStart(e: GoogleEvent) {
    const dt = e.start?.dateTime || e.start?.date
    return dt ? new Date(dt) : null
  }

  function eventInCell(e: GoogleEvent, day: Date, hour: number) {
    const st = eventStart(e)
    if (!st) return false
    return (
      st.getFullYear() === day.getFullYear() &&
      st.getMonth() === day.getMonth() &&
      st.getDate() === day.getDate() &&
      st.getHours() === hour
    )
  }

  async function loadClientAndIntegrations(email: string) {
    // 1) load client by owner_email
    const { data: c, error: cErr } = await supabase
      .from('clients')
      .select('id,business_name,owner_email,industry,phone,address,city,province,postal_code')
      .eq('owner_email', email)
      .maybeSingle()

    if (cErr || !c) {
      // If no client row exists for this email, you can decide what to do:
      // - show message
      // - auto-create client row (later)
      setClient(null)
      setIntegrations(null)
      return
    }

    setClient(c as ClientRow)

    // 2) integrations row
    const { data: i, error: iErr } = await supabase
      .from('integrations')
      .select('client_id,google_calendar_connected,retell_connected,google_calendar_id,retell_agent_id')
      .eq('client_id', (c as any).id)
      .maybeSingle()

    if (!iErr && i) setIntegrations(i as IntegrationsRow)
    else setIntegrations(null)
  }

  async function refreshCalendar() {
    if (!client?.id) return
    setCalendarLoading(true)
    setCalendarError(null)

    try {
      const start = new Date(weekStart)
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 7)

      const res = await fetch(
        `/api/calendar/events?clientId=${client.id}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
        { cache: 'no-store' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Calendar fetch failed')
      setEvents(json.events || [])
    } catch (e: any) {
      setCalendarError(e?.message || 'Calendar fetch failed')
      setEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }

  async function refreshRetell() {
    if (!client?.id) return
    setRetellLoading(true)
    setRetellError(null)

    try {
      const res = await fetch(`/api/retell/analytics?clientId=${client.id}&range=${retellRange}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Retell fetch failed')
      setRetell(json)
    } catch (e: any) {
      setRetellError(e?.message || 'Retell fetch failed')
      setRetell(null)
    } finally {
      setRetellLoading(false)
    }
  }

  const connectCalendar = () => {
    if (!client?.id) return
    window.location.href = `/api/auth/google?clientId=${client.id}`
  }

  useEffect(() => {
    ;(async () => {
      // Use cookie session (Google OAuth now working)
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email

      if (!email) {
        router.replace('/client/login')
        return
      }

      setUserEmail(email)
      await loadClientAndIntegrations(email)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!client?.id) return
    refreshCalendar()
    refreshRetell()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  useEffect(() => {
    if (!client?.id) return
    refreshRetell()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retellRange])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Loading…</div>
      </div>
    )
  }

  // If email is logged in but client row missing
  if (userEmail && !client) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="text-3xl font-semibold">Client Dashboard</div>
          <div className="text-white/60 mt-1">{userEmail}</div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">No Client Record Found</div>
            <div className="text-white/60 mt-2">
              This Google account is logged in, but it doesn’t match any client in your database (clients.owner_email).
            </div>
            <div className="text-white/60 mt-2">
              Fix: In Supabase → <span className="text-white">clients</span> table, make sure{" "}
              <span className="text-white">owner_email</span> equals this email.
            </div>
            <button
              className="mt-6 px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/client/login')
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-4xl font-semibold">{client?.business_name || 'Client Dashboard'}</div>
            <div className="text-white/60">{userEmail}</div>
          </div>

          <button
            className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
            onClick={async () => {
              await supabase.auth.signOut()
              router.replace('/client/login')
            }}
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Business Info */}
          <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold mb-4">Business Info</div>
            <div className="space-y-3 text-white/80">
              <div>
                <div className="text-white/50 text-sm">Industry</div>
                <div>{client?.industry || '—'}</div>
              </div>
              <div>
                <div className="text-white/50 text-sm">Email</div>
                <div>{client?.owner_email || userEmail}</div>
              </div>
              <div>
                <div className="text-white/50 text-sm">Phone</div>
                <div>{client?.phone || '—'}</div>
              </div>
              <div>
                <div className="text-white/50 text-sm">Address</div>
                <div>
                  {client?.address || '—'}
                  <div className="text-white/60 text-sm">
                    {[client?.city, client?.province, client?.postal_code].filter(Boolean).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Calendar */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">Your Calendar</div>

                <div className="flex items-center gap-2">
                  {integrations?.google_calendar_connected ? (
                    <span className="px-3 py-1 rounded-full text-xs border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                      You’re Connected
                    </span>
                  ) : (
                    <button
                      className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                      onClick={connectCalendar}
                    >
                      Connect Calendar
                    </button>
                  )}

                  <button
                    className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                    onClick={refreshCalendar}
                    disabled={calendarLoading}
                  >
                    {calendarLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    const d = new Date(weekStart)
                    d.setDate(d.getDate() - 7)
                    setWeekStart(d)
                  }}
                >
                  ← Prev
                </button>

                <div className="text-white/70">
                  Week of{' '}
                  {weekStart.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>

                <button
                  className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    const d = new Date(weekStart)
                    d.setDate(d.getDate() + 7)
                    setWeekStart(d)
                  }}
                >
                  Next →
                </button>
              </div>

              {calendarError && <div className="mt-3 text-sm text-red-300">{calendarError}</div>}

              <div className="mt-4 overflow-auto rounded-xl border border-white/10">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-8 bg-white/5 border-b border-white/10">
                    <div className="p-3 text-white/60 text-sm">Time</div>
                    {weekDays.map((d) => (
                      <div key={d.toISOString()} className="p-3 text-center">
                        <div className="text-white/60 text-xs">
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}
                        </div>
                        <div className="font-semibold">{d.getDate()}</div>
                      </div>
                    ))}
                  </div>

                  {hours.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 border-b border-white/10">
                      <div className="p-3 text-white/60 text-sm">{hour}:00</div>
                      {weekDays.map((day) => {
                        const cellEvents = events.filter((e) => eventInCell(e, day, hour))
                        return (
                          <div key={day.toISOString() + hour} className="p-2 border-l border-white/10 min-h-[52px]">
                            {cellEvents.map((e) => (
                              <div
                                key={e.id || `${day.toISOString()}-${hour}-${Math.random()}`}
                                className="rounded-md px-2 py-1 text-xs bg-emerald-500/10 border border-emerald-400/20 text-emerald-200 truncate"
                                title={e.summary || 'Event'}
                              >
                                {e.summary || 'Event'}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-xs text-white/50">
                This is your current week-view. If you want it **exactly** like Google Calendar (day/week/month, drag/drop),
                we’ll swap to FullCalendar next.
              </div>
            </div>

            {/* Retell */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">AI Agent Analytics (Retell)</div>

                <div className="flex items-center gap-2">
                  <select
                    className="px-3 py-2 rounded-lg border border-white/15 bg-black/40 text-white"
                    value={retellRange}
                    onChange={(e) => setRetellRange(e.target.value as any)}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="365d">Last 365 days</option>
                    <option value="all">All time</option>
                  </select>

                  <button
                    className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                    onClick={refreshRetell}
                    disabled={retellLoading}
                  >
                    {retellLoading ? 'Refreshing…' : 'Refresh'}
                  </button>

                  <span
                    className={`px-3 py-1 rounded-full text-xs border ${
                      integrations?.retell_connected
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-white/60'
                    }`}
                  >
                    {integrations?.retell_connected ? 'Retell Connected' : 'Retell Not Connected'}
                  </span>
                </div>
              </div>

              {retellError && <div className="mt-3 text-sm text-red-300">{retellError}</div>}

              {!integrations?.retell_connected ? (
                <div className="mt-5 text-white/60">
                  Retell isn’t connected for this client yet. Ask TechOps to connect it (agent ID + phone) and add the
                  master API key to platform settings / env.
                </div>
              ) : !retell ? (
                <div className="mt-5 text-white/60">No data loaded.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-xs">Total Calls ({retell.range})</div>
                      <div className="text-2xl font-semibold">{retell.summary.totalCalls}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-xs">Ended Calls</div>
                      <div className="text-2xl font-semibold">{retell.summary.totalEnded}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-xs">Avg Duration</div>
                      <div className="text-2xl font-semibold">{formatSec(retell.summary.avgDurationSec)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-xs">Success Rate</div>
                      <div className="text-2xl font-semibold">{retell.summary.successRate}%</div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-semibold mb-2">Recent Calls</div>
                    {retell.recentCalls?.length ? (
                      <div className="space-y-2">
                        {retell.recentCalls.map((c) => (
                          <div
                            key={c.call_id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm border border-white/10 rounded-lg px-3 py-2 bg-black/30"
                          >
                            <div className="text-white/80 truncate max-w-[360px]">{c.call_id}</div>
                            <div className="text-white/60">
                              {c.start_timestamp ? new Date(c.start_timestamp).toLocaleString() : '—'}
                            </div>
                            <div className="text-white/60">{c.duration_ms ? `${Math.round(c.duration_ms / 1000)}s` : '—'}</div>
                            <div className="text-white/60">{c.disconnection_reason || '—'}</div>
                            <div className="text-white/60">{c.sentiment || '—'}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/60 text-sm">No calls in this range.</div>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-white/50">
                    Want the **same richness** as Retell’s Analytics page? We’ll expand these cards into multiple charts + breakdowns next.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
