"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// Helpers
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function formatMonthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

type ClientRow = {
  id: string;
  business_name: string | null;
  owner_email: string | null;
  industry: string | null;
  phone_number: string | null;
  status: string | null;
};

type IntegrationRow = {
  retell_connected: boolean;
  google_calendar_connected: boolean;
  google_calendar_embed_url: string | null;
  google_calendar_id: string | null;
  google_calendar_email?: string | null;
};

type CalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
};

function formatEventTime(e: CalendarEvent) {
  const start = e.start?.dateTime || e.start?.date;
  const end = e.end?.dateTime || e.end?.date;
  if (!start) return "—";
  const s = new Date(start);
  if (!end) return s.toLocaleString();
  const en = new Date(end);
  const sameDay = s.toDateString() === en.toDateString();
  if (sameDay) {
    return `${s.toLocaleDateString()} ${s.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })} – ${en.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${s.toLocaleString()} – ${en.toLocaleString()}`;
}

function pillClass(kind: "base" | "green" | "blue") {
  if (kind === "green") return "bg-emerald-500/10 border-emerald-400/20 text-emerald-200";
  if (kind === "blue") return "bg-sky-500/10 border-sky-400/20 text-sky-200";
  return "bg-white/5 border-white/10 text-white/80";
}

type RetellAnalytics = {
  range: { startMs: number; endMs: number };
  totals: {
    totalCalls: number;
    successful: number;
    unsuccessful: number;
    avgDurationSec: number;
    totalDurationSec: number;
    avgLatencyMs: number | null;
  };
  breakdowns: {
    disconnectionReasons: Record<string, number>;
    userSentiments: Record<string, number>;
  };
};

function secondsToMMSS(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function topEntries(obj: Record<string, number>, n = 6) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [meEmail, setMeEmail] = useState("");
  const [client, setClient] = useState<ClientRow | null>(null);
  const [integration, setIntegration] = useState<IntegrationRow | null>(null);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // RETELL (updated)
  const [retellStats, setRetellStats] = useState<RetellAnalytics | null>(null);
  const [retellLoading, setRetellLoading] = useState(false);
  const [retellError, setRetellError] = useState<string | null>(null);

  const clientId = client?.id || "";
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - start.getDay());
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + (6 - end.getDay()));
    const out: Date[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const raw = e.start?.dateTime || e.start?.date;
      if (!raw) continue;
      const key = new Date(raw).toISOString().slice(0, 10);
      map[key] = map[key] || [];
      map[key].push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const as = new Date((a.start?.dateTime || a.start?.date) as string).getTime();
        const bs = new Date((b.start?.dateTime || b.start?.date) as string).getTime();
        return as - bs;
      });
    }
    return map;
  }, [events]);

  async function refreshCalendar(cid: string, m: Date) {
    if (!cid) return;
    try {
      const start = startOfMonth(m).toISOString();
      const end = endOfMonth(m).toISOString();

      const res = await fetch(
        `/api/calendar/events?clientId=${encodeURIComponent(cid)}&timeMin=${encodeURIComponent(
          start
        )}&timeMax=${encodeURIComponent(end)}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        setEvents([]);
        return;
      }
      const json = await res.json();
      setEvents(Array.isArray(json?.events) ? json.events : []);
      if (!selectedDay) setSelectedDay(startOfMonth(m));
    } catch {
      setEvents([]);
    }
  }

  // RETELL (updated endpoint + error handling)
  async function refreshRetell(cid: string) {
    if (!cid) return;
    setRetellLoading(true);
    setRetellError(null);

    try {
      const res = await fetch(`/api/retell/account-analytics?clientId=${encodeURIComponent(cid)}`, {
        cache: "no-store",
      });

      const text = await res.text();
      if (!res.ok) {
        setRetellStats(null);
        setRetellError(text || `Failed (${res.status})`);
        setRetellLoading(false);
        return;
      }

      setRetellStats(JSON.parse(text));
      setRetellLoading(false);
    } catch (e: any) {
      setRetellStats(null);
      setRetellError(e?.message || "Failed to load analytics.");
      setRetellLoading(false);
    }
  }

  async function loadMeAndClient() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email || "";
    setMeEmail(email);

    if (!email) {
      setClient(null);
      setIntegration(null);
      setLoading(false);
      return;
    }

    // IMPORTANT: correct schema -> owner_email + business_name
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id,business_name,owner_email,industry,phone_number,status")
      .eq("owner_email", email)
      .limit(1)
      .maybeSingle();

    if (!clientRow) {
      setClient(null);
      setIntegration(null);
      setLoading(false);
      return;
    }

    setClient(clientRow as any);

    const { data: intRow } = await supabase
      .from("integrations")
      .select("retell_connected,google_calendar_connected,google_calendar_id,google_calendar_embed_url")
      .eq("client_id", clientRow.id)
      .limit(1)
      .maybeSingle();

    setIntegration((intRow as any) || null);
    setLoading(false);

    if (!intRow?.google_calendar_embed_url) {
      await Promise.all([refreshCalendar(clientRow.id, month), refreshRetell(clientRow.id)]);
    } else {
      await Promise.all([refreshRetell(clientRow.id)]);
    }
  }

  useEffect(() => {
    loadMeAndClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId) return;
    if (integration?.google_calendar_embed_url) return;
    if (!integration?.google_calendar_connected) return;
    refreshCalendar(clientId, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const calendarStatus = integration?.google_calendar_embed_url
    ? "Embedded"
    : integration?.google_calendar_connected
    ? "Connected"
    : "Not connected";

  const retellStatus = integration?.retell_connected ? "Connected" : "Not connected";
  const isRetailClient = (client?.industry || "").trim().toLowerCase() === "retail";

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950/60 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Client Dashboard</h1>

            {loading ? (
              <div className="mt-2 text-sm opacity-70">Loading dashboard…</div>
            ) : !meEmail ? (
              <div className="mt-2 text-sm opacity-70">You are not signed in.</div>
            ) : !client ? (
              <div className="mt-2 text-sm opacity-70">
                No client profile found for <span className="font-medium">{meEmail}</span>
              </div>
            ) : (
              <>
                <div className="mt-2 text-sm opacity-70">
                  Welcome,{" "}
                  <span className="font-medium">{client.business_name || "(No business name)"}</span>
                </div>
                <div className="mt-1 text-sm opacity-70">{meEmail}</div>

                <div className="mt-4 flex items-center gap-2 flex-wrap text-xs">
                  <span className={`rounded-full border px-3 py-1 ${pillClass("base")}`}>
                    Status: <span className="font-medium">{client.status || "—"}</span>
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${pillClass("base")}`}>
                    Industry: <span className="font-medium">{client.industry || "—"}</span>
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${pillClass("green")}`}>
                    Calendar: <span className="font-medium">{calendarStatus}</span>
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${pillClass("blue")}`}>
                    Retell: <span className="font-medium">{retellStatus}</span>
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadMeAndClient}>
              Refresh
            </Button>
            {client?.industry === "Real Estate" ? (
              <Button variant="secondary" onClick={() => router.push("/client/listings")}>
                Upload New Listing
              </Button>
            ) : null}
            {isRetailClient ? (
              <Button variant="secondary" onClick={() => router.push("/dashboard/retail-ledger")}>
                Retail Ledger
              </Button>
            ) : null}
            <Button
              onClick={() => supabase.auth.signOut().then(() => router.push("/client/login"))}
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Signed out */}
        {!loading && !meEmail ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">You are not signed in.</div>
            <div className="mt-2 text-sm opacity-70">Please sign in to view your dashboard.</div>
            <div className="mt-6">
              <Button onClick={() => router.push("/client/login")}>Go to login</Button>
            </div>
          </div>
        ) : null}

        {/* No client */}
        {!loading && meEmail && !client ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">No client profile found</div>
            <div className="mt-2 text-sm opacity-70">
              Your login email is <span className="font-medium">{meEmail}</span>
            </div>
            <div className="mt-3 text-sm opacity-70">
              TechOps must create a row in <span className="font-medium">clients.owner_email</span>{" "}
              that matches this email.
            </div>
          </div>
        ) : null}

        {/* Main panels */}
        {!loading && client ? (
          <>
            {/* CALENDAR */}
            {integration?.google_calendar_embed_url ? (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-lg font-semibold">Calendar</div>
                    <div className="text-sm opacity-70">Live Google Calendar</div>
                  </div>

                  <a
                    href={integration.google_calendar_embed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline opacity-80 hover:opacity-100"
                  >
                    Open in new tab
                  </a>
                </div>

                <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                  <iframe
                    title="Google Calendar"
                    src={integration.google_calendar_embed_url || ""}
                    className="w-full h-[720px]"
                    style={{ border: 0 }}
                    scrolling="no"
                  />
                </div>

                <div className="mt-3 text-xs opacity-70">
                  If you see a permission error, the calendar owner needs to share it (or make it
                  public) for embedding.
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-lg font-semibold">Calendar</div>
                    <div className="text-sm opacity-70">Month view + events (Google Calendar)</div>
                  </div>

                  <button
                    onClick={() =>
                      integration?.google_calendar_connected && refreshCalendar(clientId, month)
                    }
                    disabled={!integration?.google_calendar_connected}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      integration?.google_calendar_connected
                        ? "border-white/15 bg-white/10 hover:bg-white/15"
                        : "border-white/5 bg-white/5 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{monthLabel}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMonth(addMonths(month, -1))}
                          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => setMonth(addMonths(month, 1))}
                          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                        >
                          ▶
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-2 text-xs opacity-70">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d} className="px-2">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {days.map((day) => {
                        const key = day.toISOString().slice(0, 10);
                        const dayEvents = eventsByDay[key] || [];
                        const inMonth = day.getMonth() === month.getMonth();
                        const isToday =
                          day.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedDay(day)}
                            className={[
                              "rounded-xl border p-2 text-left min-h-[78px] transition",
                              inMonth
                                ? "border-white/10 bg-white/5 hover:bg-white/10"
                                : "border-white/5 bg-white/0 opacity-50",
                              selectedDay?.toISOString().slice(0, 10) === key
                                ? "ring-2 ring-white/20"
                                : "",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">{day.getDate()}</div>
                              {isToday && (
                                <div className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">
                                  Today
                                </div>
                              )}
                            </div>

                            <div className="mt-1 space-y-1">
                              {dayEvents.slice(0, 2).map((e) => (
                                <div key={e.id} className="text-[11px] truncate opacity-80">
                                  • {e.summary || "Event"}
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <div className="text-[11px] opacity-60">
                                  +{dayEvents.length - 2} more
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="font-medium">Agenda</div>
                    <div className="text-sm opacity-70">
                      {selectedDay ? selectedDay.toDateString() : "Select a day"}
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedDay ? (
                        (eventsByDay[selectedDay.toISOString().slice(0, 10)] || []).length ? (
                          (eventsByDay[selectedDay.toISOString().slice(0, 10)] || []).map((e) => (
                            <div
                              key={e.id}
                              className="rounded-xl border border-white/10 bg-black/20 p-3"
                            >
                              <div className="font-medium">{e.summary || "Event"}</div>
                              <div className="text-xs opacity-70 mt-1">{formatEventTime(e)}</div>
                              {e.location && (
                                <div className="text-xs opacity-70 mt-1">{e.location}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm opacity-70">No events for this day.</div>
                        )
                      ) : (
                        <div className="text-sm opacity-70">Pick a day to see events.</div>
                      )}
                    </div>

                    {!integration?.google_calendar_connected && (
                      <div className="mt-6 text-sm opacity-70">
                        Google Calendar is not connected yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RETELL (updated UI only) */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">Retell Analytics</div>
                  <div className="text-sm opacity-70">Account-wide totals (All agents)</div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => refreshRetell(clientId)}
                  disabled={!integration?.retell_connected || retellLoading}
                >
                  {retellLoading ? "Loading…" : "Refresh"}
                </Button>
              </div>

              {!integration?.retell_connected ? (
                <div className="mt-6 text-sm opacity-70">Retell is not connected yet.</div>
              ) : retellError ? (
                <div className="mt-6 text-sm text-red-300">
                  Failed to load analytics.{" "}
                  <span className="opacity-80 break-all">{retellError}</span>
                </div>
              ) : !retellStats ? (
                <div className="mt-6 text-sm opacity-70">No data yet.</div>
              ) : (
                <div className="mt-6">
                  {/* Top KPI cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="text-sm opacity-70">Call Counts</div>
                      <div className="mt-2 text-4xl font-semibold">
                        {retellStats.totals.totalCalls}
                      </div>
                      <div className="mt-2 text-xs opacity-70">
                        Successful: {retellStats.totals.successful} • Unsuccessful:{" "}
                        {retellStats.totals.unsuccessful}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="text-sm opacity-70">Call Duration</div>
                      <div className="mt-2 text-4xl font-semibold">
                        {secondsToMMSS(retellStats.totals.avgDurationSec)}
                      </div>
                      <div className="mt-2 text-xs opacity-70">
                        Total: {secondsToMMSS(retellStats.totals.totalDurationSec)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="text-sm opacity-70">Call Latency</div>
                      <div className="mt-2 text-4xl font-semibold">
                        {retellStats.totals.avgLatencyMs === null
                          ? "—"
                          : `${Math.round(retellStats.totals.avgLatencyMs)}ms`}
                      </div>
                      <div className="mt-2 text-xs opacity-70">
                        Avg across calls that reported latency
                      </div>
                    </div>
                  </div>

                  {/* Breakdowns */}
                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="text-sm font-medium">Disconnection Reason</div>
                      <div className="mt-3 space-y-2 text-sm">
                        {topEntries(retellStats.breakdowns.disconnectionReasons, 8).map(
                          ([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-3">
                              <div className="truncate opacity-80">{k}</div>
                              <div className="tabular-nums opacity-90">{v}</div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="text-sm font-medium">User Sentiment</div>
                      <div className="mt-3 space-y-2 text-sm">
                        {topEntries(retellStats.breakdowns.userSentiments, 8).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-3">
                            <div className="truncate opacity-80">{k}</div>
                            <div className="tabular-nums opacity-90">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs opacity-70">
                    Range: {new Date(retellStats.range.startMs).toLocaleDateString()} –{" "}
                    {new Date(retellStats.range.endMs).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
