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

type WeeklyReport = {
  id: string;
  week_start: string;
  week_end: string;
  report_file_name: string;
  created_at: string;
  analysis_json: {
    summary?: { title?: string; subtitle?: string; periodLabel?: string };
    kpis?: Array<{
      id: string;
      label: string;
      value: number | string;
      unit: string | null;
      changePercent: number | null;
      trend: "up" | "down" | "flat" | "unknown";
    }>;
    charts?: Array<{
      id: string;
      title: string;
      type: "bar" | "line" | "area" | "donut";
      points: Array<{ label: string; value: number }>;
    }>;
    highlights?: string[];
    notes?: string[];
  } | null;
};

type ClientReport = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  download_url: string | null;
};

function chartPointMax(points: Array<{ value: number }>) {
  const max = points.reduce((acc, item) => Math.max(acc, item.value), 0);
  return max > 0 ? max : 1;
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

  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [clientReports, setClientReports] = useState<ClientReport[]>([]);
  const [clientReportsError, setClientReportsError] = useState<string | null>(null);

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

  async function refreshWeeklyAnalysis(cid: string) {
    if (!cid) return;
    setWeeklyLoading(true);
    setWeeklyError(null);

    try {
      const res = await fetch("/api/client/weekly-analysis", {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        setWeeklyReport(null);
        setWeeklyError(text || `Failed (${res.status})`);
        setWeeklyLoading(false);
        return;
      }

      const json = await res.json();
      setWeeklyReport((json?.report as WeeklyReport) || null);
      setWeeklyLoading(false);
    } catch (e: unknown) {
      setWeeklyReport(null);
      setWeeklyError(e instanceof Error ? e.message : "Failed to load weekly analysis.");
      setWeeklyLoading(false);
    }
  }

  async function refreshClientReports(cid: string) {
    if (!cid) return;
    setClientReportsError(null);
    try {
      const res = await fetch("/api/client/reports", {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        setClientReports([]);
        setClientReportsError(text || `Failed (${res.status})`);
        return;
      }
      const json = await res.json();
      setClientReports(Array.isArray(json?.reports) ? json.reports : []);
    } catch (e: unknown) {
      setClientReports([]);
      setClientReportsError(e instanceof Error ? e.message : "Failed to load client reports.");
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

    setClient(clientRow as ClientRow);

    const { data: intRow } = await supabase
      .from("integrations")
      .select("retell_connected,google_calendar_connected,google_calendar_id,google_calendar_embed_url")
      .eq("client_id", clientRow.id)
      .limit(1)
      .maybeSingle();

    setIntegration((intRow as IntegrationRow) || null);
    setLoading(false);

    if (!intRow?.google_calendar_embed_url) {
      await Promise.all([
        refreshCalendar(clientRow.id, month),
        refreshWeeklyAnalysis(clientRow.id),
        refreshClientReports(clientRow.id),
      ]);
    } else {
      await Promise.all([refreshWeeklyAnalysis(clientRow.id), refreshClientReports(clientRow.id)]);
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
  const isHealthcareClient = (client?.industry || "").trim().toLowerCase() === "healthcare";

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
            {isHealthcareClient ? (
              <Button variant="secondary" onClick={() => router.push("/dashboard/healthcare-crm")}>
                Healthcare CRM
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

            {/* WEEKLY ANALYSIS */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">Weekly Analysis</div>
                  <div className="text-sm opacity-70">
                    Uploaded by TechOps from your weekly analytics PDF
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    Promise.all([refreshWeeklyAnalysis(clientId), refreshClientReports(clientId)])
                  }
                  disabled={weeklyLoading}
                >
                  {weeklyLoading ? "Loading…" : "Refresh"}
                </Button>
              </div>

              {weeklyError ? (
                <div className="mt-6 text-sm text-red-300">
                  Failed to load weekly analysis.{" "}
                  <span className="opacity-80 break-all">{weeklyError}</span>
                </div>
              ) : !weeklyReport ? (
                <div className="mt-6 space-y-4">
                  <div className="text-sm opacity-70">
                    No weekly PDF analytics uploaded yet. You can still download shared report files
                    below.
                  </div>
                  {clientReportsError ? (
                    <div className="text-sm text-red-300">
                      Failed to load shared reports.{" "}
                      <span className="opacity-80 break-all">{clientReportsError}</span>
                    </div>
                  ) : clientReports.length ? (
                    <div className="rounded-xl border border-white/10 bg-black/20">
                      <div className="grid grid-cols-12 px-3 py-2 text-xs uppercase tracking-wide text-white/50">
                        <div className="col-span-6">File</div>
                        <div className="col-span-3">Uploaded</div>
                        <div className="col-span-3 text-right">Action</div>
                      </div>
                      {clientReports.map((report) => (
                        <div
                          key={report.id}
                          className="grid grid-cols-12 items-center border-t border-white/5 px-3 py-3 text-sm text-white/85"
                        >
                          <div className="col-span-6 truncate">{report.file_name}</div>
                          <div className="col-span-3">
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                          <div className="col-span-3 text-right">
                            {report.download_url ? (
                              <a
                                href={report.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
                              >
                                Download
                              </a>
                            ) : (
                              <span className="text-xs opacity-60">Unavailable</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6">
                  <div className="mb-4">
                    <div className="text-xl font-semibold">
                      {weeklyReport.analysis_json?.summary?.title || "Weekly Performance Report"}
                    </div>
                    <div className="text-sm opacity-70 mt-1">
                      {weeklyReport.analysis_json?.summary?.subtitle || "Latest uploaded analytics"}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      Period:{" "}
                      {weeklyReport.analysis_json?.summary?.periodLabel ||
                        `${weeklyReport.week_start} to ${weeklyReport.week_end}`}{" "}
                      • Uploaded: {new Date(weeklyReport.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {(weeklyReport.analysis_json?.kpis || []).map((kpi) => (
                      <div
                        key={kpi.id}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-[0_0_22px_rgba(16,185,129,0.22)]"
                      >
                        <div className="text-xs opacity-70">{kpi.label}</div>
                        <div className="mt-2 text-3xl font-semibold">
                          {kpi.value}
                          {kpi.unit ? (
                            <span className="text-base ml-1 opacity-80">{kpi.unit}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs opacity-70">
                          {kpi.changePercent === null
                            ? "No change data"
                            : `${kpi.changePercent}% vs previous period`}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(weeklyReport.analysis_json?.charts || []).map((chart) => {
                      const max = chartPointMax(chart.points || []);
                      return (
                        <div
                          key={chart.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-sky-300/40"
                        >
                          <div className="text-sm font-medium mb-3">{chart.title}</div>
                          <div className="space-y-2">
                            {chart.points.map((point) => (
                              <div key={`${chart.id}-${point.label}`}>
                                <div className="flex items-center justify-between text-xs opacity-80">
                                  <span>{point.label}</span>
                                  <span className="tabular-nums">{point.value}</span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-700"
                                    style={{
                                      width: `${Math.max(
                                        4,
                                        Math.round((point.value / max) * 100)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(weeklyReport.analysis_json?.highlights || []).length ? (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium mb-2">Highlights</div>
                      <ul className="space-y-1 text-sm opacity-85">
                        {(weeklyReport.analysis_json?.highlights || []).map((item, idx) => (
                          <li key={`${idx}-${item}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {clientReportsError ? (
                    <div className="mt-6 text-sm text-red-300">
                      Failed to load shared reports.{" "}
                      <span className="opacity-80 break-all">{clientReportsError}</span>
                    </div>
                  ) : clientReports.length ? (
                    <div className="mt-6 rounded-xl border border-white/10 bg-black/20">
                      <div className="grid grid-cols-12 px-3 py-2 text-xs uppercase tracking-wide text-white/50">
                        <div className="col-span-6">File</div>
                        <div className="col-span-3">Uploaded</div>
                        <div className="col-span-3 text-right">Action</div>
                      </div>
                      {clientReports.map((report) => (
                        <div
                          key={report.id}
                          className="grid grid-cols-12 items-center border-t border-white/5 px-3 py-3 text-sm text-white/85"
                        >
                          <div className="col-span-6 truncate">{report.file_name}</div>
                          <div className="col-span-3">
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                          <div className="col-span-3 text-right">
                            {report.download_url ? (
                              <a
                                href={report.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
                              >
                                Download
                              </a>
                            ) : (
                              <span className="text-xs opacity-60">Unavailable</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
