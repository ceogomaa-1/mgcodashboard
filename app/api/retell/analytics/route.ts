import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RetellCall = {
  call_id: string
  agent_id?: string
  call_status?: string
  start_timestamp?: number
  duration_ms?: number
  user_sentiment?: string
  disconnection_reason?: string
  call_analysis?: {
    user_sentiment?: string
    call_successful?: boolean
  }
  latency?: {
    end_to_end_ms?: number
  }
}

function isoDate(tsMs?: number) {
  if (!tsMs) return null
  const d = new Date(tsMs)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseRangeToDays(range: string | null) {
  if (!range) return 7
  if (range === 'all') return null
  const m = range.match(/^(\d+)\s*d$/i)
  if (!m) return 7
  return Math.max(1, Math.min(3650, Number(m[1])))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const range = searchParams.get('range') // 7d | 30d | 90d | 365d | all

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // 1) Get integration info
    const { data: integration } = await supabase
      .from('integrations')
      .select('retell_connected, retell_agent_id')
      .eq('client_id', clientId)
      .maybeSingle()

    if (!integration?.retell_connected || !integration?.retell_agent_id) {
      return NextResponse.json({ error: 'Retell not connected for this client' }, { status: 400 })
    }

    // 2) Get API key
    let apiKey = process.env.RETELL_API_KEY || ''
    if (!apiKey) {
      const { data: s } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'retell_api_key')
        .maybeSingle()
      apiKey = (s as any)?.value || ''
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY missing (set it in .env.local or platform_settings)' },
        { status: 400 }
      )
    }

    const now = Date.now()
    const days = parseRangeToDays(range)
    const lower = days == null ? null : now - days * 24 * 60 * 60 * 1000

    // 3) Call Retell list-calls
    // NOTE: Retell’s list-calls is paginated; we’ll pull a larger slice and compute.
    const body: any = {
      filter_criteria: {
        agent_id: [integration.retell_agent_id],
      },
      sort_order: 'descending',
      limit: 200,
    }

    if (lower != null) {
      body.filter_criteria.start_timestamp = {
        lower_threshold: lower,
        upper_threshold: now,
      }
    }

    const retellRes = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const raw = await retellRes.json()
    if (!retellRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Retell calls', details: raw },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const calls: RetellCall[] = Array.isArray(raw) ? raw : (raw?.calls ?? [])
    const ended = calls.filter(c => c.call_status === 'ended' && typeof c.duration_ms === 'number')

    // Summary
    const totalCalls = calls.length
    const totalEnded = ended.length

    const totalDurationMs = ended.reduce((s, c) => s + (c.duration_ms || 0), 0)
    const avgDurationSec = totalEnded ? Math.round(totalDurationMs / totalEnded / 1000) : 0

    const successful = ended.filter(c => c.call_analysis?.call_successful === true).length
    const successRate = totalEnded ? Math.round((successful / totalEnded) * 100) : 0

    const sentiment = { positive: 0, neutral: 0, negative: 0, unknown: 0 }
    for (const c of ended) {
      const s = (c.call_analysis?.user_sentiment || c.user_sentiment || 'unknown').toLowerCase()
      if (s.includes('positive')) sentiment.positive++
      else if (s.includes('neutral')) sentiment.neutral++
      else if (s.includes('negative')) sentiment.negative++
      else sentiment.unknown++
    }

    const disconnection: Record<string, number> = {}
    for (const c of calls) {
      const r = c.disconnection_reason || 'unknown'
      disconnection[r] = (disconnection[r] || 0) + 1
    }

    // Timeseries (daily)
    const byDay: Record<string, { date: string; calls: number; minutes: number }> = {}
    for (const c of calls) {
      const d = isoDate(c.start_timestamp) || 'Unknown'
      byDay[d] ||= { date: d, calls: 0, minutes: 0 }
      byDay[d].calls++
    }
    for (const c of ended) {
      const d = isoDate(c.start_timestamp) || 'Unknown'
      byDay[d] ||= { date: d, calls: 0, minutes: 0 }
      byDay[d].minutes += Math.round((c.duration_ms || 0) / 1000 / 60)
    }

    // Build a windowed list (for charts)
    const chartDays = days ?? 60 // if all-time, just show last 60 days chart
    const series: { date: string; calls: number; minutes: number }[] = []
    for (let i = chartDays - 1; i >= 0; i--) {
      const dt = new Date(now - i * 24 * 60 * 60 * 1000)
      const key = isoDate(dt.getTime())!
      series.push(byDay[key] || { date: key, calls: 0, minutes: 0 })
    }

    // Recent calls
    const recentCalls = calls.slice(0, 12).map(c => ({
      call_id: c.call_id,
      call_status: c.call_status,
      start_timestamp: c.start_timestamp,
      duration_ms: c.duration_ms,
      sentiment: c.call_analysis?.user_sentiment || c.user_sentiment || 'unknown',
      successful: c.call_analysis?.call_successful ?? null,
      disconnection_reason: c.disconnection_reason || 'unknown',
    }))

    return NextResponse.json(
      {
        range: range || '7d',
        summary: {
          totalCalls,
          totalEnded,
          avgDurationSec,
          successRate,
          sentiment,
          disconnection,
        },
        series,
        recentCalls,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { error: 'Retell analytics failed', details: err?.message || 'unknown' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
