"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// UI
import { Button } from "@/components/ui/button";

type IntegrationRow = {
  client_id: string;
  retell_connected: boolean | null;
  google_calendar_connected: boolean | null;
  google_calendar_embed_url: string | null;
  retell_agent_id: string | null;
  google_calendar_id: string | null;
  google_calendar_email: string | null;
};

type ClientRow = {
  id: string;
  business_name: string | null;
  owner_email: string | null;
  industry: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string | null;
  created_at?: string;
  updated_at?: string;

  integrations?: IntegrationRow | null;
};

function pillClass(kind: "base" | "green" | "blue") {
  if (kind === "green") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  if (kind === "blue") return "border-sky-400/25 bg-sky-500/10 text-sky-100";
  return "border-white/10 bg-white/5 text-white";
}

export default function TechOpsDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string>("");

  const stats = useMemo(() => {
    const total = clients.length;
    const cal = clients.filter((c) => !!c.integrations?.google_calendar_connected).length;
    const ret = clients.filter((c) => !!c.integrations?.retell_connected).length;
    return { total, cal, ret };
  }, [clients]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/techops/clients/list", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        setError(t || "Failed to load clients");
        setClients([]);
        setLoading(false);
        return;
      }

      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json?.clients) ? json.clients : [];
      setClients(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load clients");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteClient(clientId: string, label: string) {
    const ok = confirm(
      `Delete client "${label}"?\n\nThis will delete the client row + integrations row.`
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/techops/clients/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) {
        const t = await res.text();
        alert(t || "Delete failed");
        return;
      }

      await load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    // ✅ SAME “Client Dashboard” vibe: dark gradient + subtle glow
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950/30">
      <div className="mx-auto max-w-6xl px-6 py-10 text-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl border border-white/10 bg-emerald-500/10 flex items-center justify-center">
              <div className="h-5 w-5 rounded-md bg-emerald-400/80" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight">TechOps Dashboard</h1>
              <div className="mt-1 text-sm opacity-70">Manage clients + integrations status</div>

              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                <span className={`rounded-full border px-3 py-1 ${pillClass("base")}`}>
                  Total: <span className="font-medium">{stats.total}</span>
                </span>
                <span className={`rounded-full border px-3 py-1 ${pillClass("green")}`}>
                  Calendar connected: <span className="font-medium">{stats.cal}</span>
                </span>
                <span className={`rounded-full border px-3 py-1 ${pillClass("blue")}`}>
                  Retell connected: <span className="font-medium">{stats.ret}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load}>
              Refresh
            </Button>
            <Button onClick={() => router.push("/techops/clients/new")}>+ Add Client</Button>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Clients */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">Clients</div>
            <div className="text-sm opacity-70">{clients.length} client(s)</div>
          </div>

          {loading ? (
            <div className="mt-6 text-sm opacity-70">Loading clients…</div>
          ) : clients.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm opacity-70">
              No clients found.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {clients.map((c) => {
                const calConnected = !!c.integrations?.google_calendar_connected;
                const retConnected = !!c.integrations?.retell_connected;
                const label = c.business_name || c.owner_email || c.id;

                return (
                  // ✅ Same dark “glass” card as Client Dashboard (bg-black/20, border-white/10)
                  <div
                    key={c.id}
                    onClick={() => router.push(`/techops/clients/${c.id}`)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-base font-semibold">
                          {c.business_name || "(No business name)"}
                        </div>
                        <div className="mt-1 text-sm opacity-70">
                          {c.owner_email || "(No owner email)"}
                        </div>

                        <div className="mt-1 text-xs opacity-60">
                          {c.industry || "—"}
                          {" • "}
                          {c.phone_number || "—"}
                        </div>

                        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                          <span className={`rounded-full border px-3 py-1 ${pillClass("base")}`}>
                            Status: <span className="font-medium">{c.status || "—"}</span>
                          </span>

                          <span className={`rounded-full border px-3 py-1 ${pillClass("green")}`}>
                            Calendar:{" "}
                            <span className="font-medium">
                              {calConnected ? "Connected" : "Not connected"}
                            </span>
                          </span>

                          <span className={`rounded-full border px-3 py-1 ${pillClass("blue")}`}>
                            Retell:{" "}
                            <span className="font-medium">
                              {retConnected ? "Connected" : "Not connected"}
                            </span>
                          </span>

                          {!!c.integrations?.google_calendar_embed_url && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white">
                              Embed: <span className="font-medium">Yes</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/techops/clients/${c.id}`);
                          }}
                        >
                          Open
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClient(c.id, label);
                          }}
                          className="border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 text-red-200"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
