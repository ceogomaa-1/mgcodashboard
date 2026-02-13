"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AgentListRow = {
  id: string;
  name: string;
  industry: string;
  twilio_phone_number: string;
  status: string;
};

type CallRow = {
  id: string;
  agent_id: string;
  client_id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  transcript: string | null;
  summary: string | null;
  created_at: string;
};

type CallEventRow = {
  id: string;
  call_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function outcomeLabel(outcome: string | null) {
  return outcome || "other";
}

export function AIReceptionistSection({ clientId }: { clientId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [agents, setAgents] = useState<AgentListRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [events, setEvents] = useState<CallEventRow[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/client/ai-receptionist", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Failed to load AI receptionist data");

      const nextCalls = json.calls || [];
      setAgents(json.agents || []);
      setCalls(nextCalls);
      setSelectedCallId((current) => current || nextCalls[0]?.id || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load AI receptionist section");
    } finally {
      setLoading(false);
    }
  }

  async function loadCallEvents(callId: string) {
    const res = await fetch(`/api/client/ai-receptionist/events?call_id=${encodeURIComponent(callId)}`, {
      cache: "no-store",
    });
    const json = await res.json();

    if (!res.ok) {
      setEvents([]);
      return;
    }

    setEvents(json.events || []);
  }

  useEffect(() => {
    loadAll();
  }, [clientId]);

  useEffect(() => {
    if (!selectedCallId) {
      setEvents([]);
      return;
    }
    loadCallEvents(selectedCallId);
  }, [selectedCallId]);

  useEffect(() => {
    if (!clientId) return;

    const callsChannel = supabase
      .channel(`calls:${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `client_id=eq.${clientId}` },
        () => loadAll()
      )
      .subscribe();

    const eventsChannel = supabase
      .channel(`call_events:${clientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_events", filter: `client_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as {
            id?: string;
            call_id?: string;
            type?: string;
            payload?: Record<string, unknown>;
            created_at?: string;
          };
          if (!row?.id) return;

          if (selectedCallId && row.call_id === selectedCallId) {
            setEvents((current) => [
              ...current,
              {
                id: String(row.id),
                call_id: row.call_id || "",
                type: row.type || "tool_result",
                payload: row.payload || {},
                created_at: row.created_at || new Date().toISOString(),
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [clientId, selectedCallId, supabase]);

  const liveCalls = useMemo(() => calls.filter((call) => !call.ended_at).length, [calls]);

  const outcomes = useMemo(() => {
    const map = new Map<string, number>();
    for (const call of calls) {
      const key = outcomeLabel(call.outcome);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [calls]);

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) || null,
    [calls, selectedCallId]
  );

  return (
    <Card className="mt-8 border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>AI Receptionist</CardTitle>
        <Button variant="secondary" onClick={loadAll}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm opacity-70">Loading AI receptionist analytics...</div>
        ) : error ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm opacity-70">Published agents</div>
                <div className="mt-1 text-3xl font-semibold">{agents.length}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm opacity-70">Live calls</div>
                <div className="mt-1 text-3xl font-semibold">{liveCalls}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                <div className="text-sm opacity-70">Outcomes</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                  {outcomes.length === 0 ? (
                    <span className="opacity-70">No calls yet</span>
                  ) : (
                    outcomes.map(([key, count]) => (
                      <span
                        key={key}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                      >
                        {key}: {count}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-medium">Agents</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {agents.map((agent) => (
                  <div key={agent.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="font-medium">{agent.name}</div>
                    <div className="opacity-70">{agent.twilio_phone_number}</div>
                  </div>
                ))}
                {agents.length === 0 ? <div className="opacity-70">No published agents.</div> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium">Recent Calls</div>
                <div className="mt-3 space-y-2 max-h-96 overflow-auto">
                  {calls.map((call) => (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCallId(call.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        selectedCallId === call.id
                          ? "border-emerald-400/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-sm font-medium">{outcomeLabel(call.outcome)}</div>
                      <div className="text-xs opacity-70">
                        {call.from_number || "Unknown"} {"->"} {call.to_number || "Unknown"}
                      </div>
                      <div className="text-xs opacity-60">
                        {call.started_at ? new Date(call.started_at).toLocaleString() : "Unknown time"}
                      </div>
                    </button>
                  ))}
                  {calls.length === 0 ? <div className="text-sm opacity-70">No calls yet.</div> : null}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium">Transcript & Summary</div>
                {!selectedCall ? (
                  <div className="mt-3 text-sm opacity-70">Select a call to inspect details.</div>
                ) : (
                  <div className="mt-3 space-y-4">
                    <div>
                      <div className="text-xs opacity-60">Summary</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">
                        {selectedCall.summary || "No summary available yet."}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs opacity-60">Transcript</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                        {selectedCall.transcript || "No transcript available yet."}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs opacity-60">Live timeline</div>
                      <div className="mt-2 space-y-2 max-h-40 overflow-auto">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          >
                            <div className="font-medium">{event.type}</div>
                            <div className="opacity-70">{new Date(event.created_at).toLocaleString()}</div>
                          </div>
                        ))}
                        {events.length === 0 ? (
                          <div className="text-xs opacity-70">No timeline events yet.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
