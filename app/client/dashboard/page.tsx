"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  business_name: string;
  owner_email: string;
  industry: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string | null;
};

type IntegrationRow = {
  retell_connected: boolean;
  retell_phone_number: string | null;
  google_calendar_connected: boolean;
  google_calendar_id: string | null;
};

type GoogleEvent = {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
};

type RetellAnalytics = {
  totalCalls?: number;
  answered?: number;
  missed?: number;
  avgDurationSec?: number;
  lastSyncAt?: string;
};

function iso(d: Date) {
  return d.toISOString();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [meEmail, setMeEmail] = useState<string>("");

  const [client, setClient] = useState<ClientRow | null>(null);
  const [integration, setIntegration] = useState<IntegrationRow | null>(null);

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [retell, setRetell] = useState<RetellAnalytics | null>(null);
  const [retellLoading, setRetellLoading] = useState(false);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
    return fmt.format(month);
  }, [month]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];

    // build grid starting Sunday
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - start.getDay());

    // 6 weeks grid
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      if (d < endOfMonth(addMonths(month, -1)) || d > endOfMonth(addMonths(month, 2))) {
        // safety guard (doesn't really happen)
      }
      days.push(d);
    }
    return days;
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, GoogleEvent[]>();
    for (const e of events) {
      const dt = e.start.dateTime || e.start.date;
      if (!dt) continue;
      const d = new Date(dt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  async function loadMeAndClient() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const email = user?.email || "";
    setMeEmail(email);

    if (!email) {
      router.replace("/client/login");
      return;
    }

    // Find client by owner_email
    const { data: clientRow, error: cErr } = await supabase
      .from("clients")
      .select("id,business_name,owner_email,industry,phone_number,address,city,state,zip_code,status")
      .eq("owner_email", email)
      .maybeSingle();

    if (cErr) {
      console.error(cErr);
      setClient(null);
      setIntegration(null);
      setLoading(false);
      return;
    }

    if (!clientRow) {
      setClient(null);
      setIntegration(null);
      setLoading(false);
      return;
    }

    setClient(clientRow as any);

    const { data: intRow, error: iErr } = await supabase
      .from("integrations")
      .select("retell_connected,retell_phone_number,google_calendar_connected,google_calendar_id")
      .eq("client_id", clientRow.id)
      .maybeSingle();

    if (iErr) console.error(iErr);
    setIntegration((intRow as any) || null);

    setLoading(false);

    // Load external panels
    await Promise.all([refreshCalendar(clientRow.id, month), refreshRetell(clientRow.id)]);
  }

  async function refreshCalendar(clientId: string, monthDate: Date) {
    setEventsLoading(true);
    try {
      const start = iso(startOfMonth(monthDate));
      const end = iso(endOfMonth(monthDate));

      const res = await fetch(
        `/api/calendar/events?clientId=${encodeURIComponent(clientId)}&start=${encodeURIComponent(
          start
        )}&end=${encodeURIComponent(end)}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        const t = await res.text();
        console.error("calendar events error:", t);
        setEvents([]);
        return;
      }

      const json = await res.json();
      setEvents(Array.isArray(json.events) ? json.events : []);
    } catch (e) {
      console.error(e);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  async function refreshRetell(clientId: string) {
    setRetellLoading(true);
    try {
      const res = await fetch(`/api/retell/analytics?clientId=${encodeURIComponent(clientId)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("retell analytics error:", t);
        setRetell(null);
        return;
      }

      const json = await res.json();
      setRetell(json?.analytics || null);
    } catch (e) {
      console.error(e);
      setRetell(null);
    } finally {
      setRetellLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/client/login");
  }

  useEffect(() => {
    loadMeAndClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When month changes, reload calendar
  useEffect(() => {
    if (!client?.id) return;
    refreshCalendar(client.id, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, client?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="opacity-70">Loading…</div>
      </div>
    );
  }

  if (!meEmail) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="opacity-70">Not logged in.</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h1 className="text-3xl font-semibold">Client Dashboard</h1>
          <p className="mt-2 opacity-70">{meEmail}</p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xl font-semibold">No Client Record Found</div>
            <p className="mt-2 opacity-70">
              This Google account is logged in, but it doesn’t match any client in your database
              (clients.owner_email).
            </p>
            <button
              onClick={logout}
              className="mt-6 rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  const addressLine = [client.address, client.city, client.state, client.zip_code]
    .filter(Boolean)
    .join(", ");

  const calConnected = !!integration?.google_calendar_connected;
  const retellConnected = !!integration?.retell_connected;

  const selectedEvents = selectedDay ? eventsByDay.get(dayKey(selectedDay)) || [] : [];

  return (
    <div className="min-h-screen text-white bg-black">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Client Dashboard</h1>
            <div className="mt-2 opacity-70">{meEmail}</div>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Logout
          </button>
        </div>

        {/* Top cards */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="text-lg font-semibold">Business Info</div>

            <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <div className="opacity-70">Business</div>
              <div className="text-right">{client.business_name}</div>

              <div className="opacity-70">Industry</div>
              <div className="text-right">{client.industry || "—"}</div>

              <div className="opacity-70">Status</div>
              <div className="text-right">{client.status || "—"}</div>

              <div className="opacity-70">Phone</div>
              <div className="text-right">{client.phone_number || "—"}</div>

              <div className="opacity-70">Address</div>
              <div className="text-right">{addressLine || "—"}</div>
            </div>

            <div className="mt-6 text-xs opacity-60">Client ID: {client.id}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Integrations</div>
                <div className="mt-1 text-sm opacity-70">Connection status</div>
              </div>

              <div className="flex gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs border ${
                    retellConnected
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  Retell: {retellConnected ? "Connected" : "Not connected"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs border ${
                    calConnected
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  Calendar: {calConnected ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-base font-semibold">Retell AI</div>
                <div className="mt-1 text-sm opacity-70">
                  Phone: {integration?.retell_phone_number || "—"}
                </div>
                <div className="mt-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs border ${
                      retellConnected
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    {retellConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-base font-semibold">Google Calendar</div>
                <div className="mt-1 text-sm opacity-70">
                  Calendar ID: {integration?.google_calendar_id || "—"}
                </div>
                <div className="mt-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs border ${
                      calConnected
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    {calConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CALENDAR FULL WIDTH */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Calendar</div>
              <div className="text-sm opacity-70">Month view + daily details</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
                onClick={() => setMonth(addMonths(month, -1))}
              >
                Prev
              </button>
              <div className="px-3 py-2 rounded-xl border border-white/10 bg-black/20 text-sm">
                {monthLabel}
              </div>
              <button
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                Next
              </button>

              <button
                className="ml-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 hover:bg-emerald-500/20"
                onClick={() => refreshCalendar(client.id, month)}
                disabled={eventsLoading}
              >
                {eventsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-white/10 text-xs uppercase tracking-wide opacity-70">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-4 py-3">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((d, idx) => {
                const inMonth = d.getMonth() === month.getMonth();
                const today = sameDay(d, new Date());
                const evs = eventsByDay.get(dayKey(d)) || [];
                const isSelected = selectedDay ? sameDay(d, selectedDay) : false;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(new Date(d))}
                    className={[
                      "text-left px-4 py-4 border-t border-white/5 min-h-[92px] hover:bg-white/5 transition",
                      inMonth ? "" : "opacity-40",
                      today ? "bg-emerald-500/10" : "",
                      isSelected ? "outline outline-2 outline-emerald-500/40 -outline-offset-2" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{d.getDate()}</div>
                      {evs.length > 0 && (
                        <div className="text-[10px] rounded-full px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                          {evs.length}
                        </div>
                      )}
                    </div>

                    {/* tiny preview list */}
                    <div className="mt-2 space-y-1">
                      {evs.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          className="text-xs truncate opacity-80"
                          title={e.summary}
                        >
                          • {e.summary}
                        </div>
                      ))}
                      {evs.length > 2 && (
                        <div className="text-xs opacity-50">+ {evs.length - 2} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day details */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm opacity-80">
                {selectedDay ? (
                  <>
                    Events on{" "}
                    <span className="font-semibold">
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }).format(selectedDay)}
                    </span>
                  </>
                ) : (
                  "Click a day to see details"
                )}
              </div>

              {selectedDay && (
                <button
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10 text-sm"
                  onClick={() => setSelectedDay(null)}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {selectedDay && selectedEvents.length === 0 && (
                <div className="text-sm opacity-60">No events found for this day.</div>
              )}

              {selectedEvents.map((e) => {
                const start = e.start.dateTime || e.start.date;
                const end = e.end.dateTime || e.end.date;

                return (
                  <a
                    key={e.id}
                    href={e.htmlLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
                  >
                    <div className="font-semibold">{e.summary}</div>
                    <div className="mt-1 text-sm opacity-70">
                      {start ? new Date(start).toLocaleString() : "—"}
                      {end ? ` → ${new Date(end).toLocaleString()}` : ""}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* RETELL ANALYTICS BELOW CALENDAR */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Retell Analytics</div>
              <div className="text-sm opacity-70">Calls + performance overview</div>
            </div>

            <button
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 hover:bg-emerald-500/20"
              onClick={() => refreshRetell(client.id)}
              disabled={retellLoading}
            >
              {retellLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Calls" value={retell?.totalCalls} />
            <StatCard label="Answered" value={retell?.answered} />
            <StatCard label="Missed" value={retell?.missed} />
            <StatCard
              label="Avg Duration"
              value={
                typeof retell?.avgDurationSec === "number"
                  ? `${Math.round(retell.avgDurationSec)}s`
                  : undefined
              }
            />
          </div>

          <div className="mt-4 text-xs opacity-60">
            Last sync: {retell?.lastSyncAt ? new Date(retell.lastSyncAt).toLocaleString() : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: any }) {
  const display = value === 0 ? "0" : value ? String(value) : "—";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="text-sm opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{display}</div>
    </div>
  );
}
