"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ClientRow = {
  id: string;
  name: string | null;
  email: string | null;
  industry: string | null;
  status: string | null;
  calendar_connected: boolean;
  retell_connected: boolean;
};

export default function TechOpsDashboardPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadClients() {
    setLoading(true);
    try {
      const res = await fetch("/api/techops/clients/list", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load clients");
      setClients(j.clients || []);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteClient(id?: string) {
    if (!id) {
      alert("Client id is missing. Refusing to delete.");
      return;
    }
    if (!confirm("Delete this client + integrations? This cannot be undone.")) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/techops/clients/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      await loadClients();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const stats = useMemo(() => {
    const total = clients.length;
    const cal = clients.filter((c) => c.calendar_connected).length;
    const ret = clients.filter((c) => c.retell_connected).length;
    return { total, cal, ret };
  }, [clients]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="h-6 w-6 rounded-md bg-emerald-400/80" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold">TechOps Dashboard</h1>
                <p className="text-sm opacity-70">Manage clients + integrations status</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Total: {stats.total}</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-400/20">
                Calendar connected: {stats.cal}
              </Badge>
              <Badge className="bg-sky-500/15 text-sky-200 border-sky-400/20">
                Retell connected: {stats.ret}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadClients} disabled={loading}>
              Refresh
            </Button>
            <Link href="/techops/clients/new">
              <Button>+ Add Client</Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Clients</h2>
            <div className="text-sm opacity-60">{clients.length} client(s)</div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm opacity-70">
              Loading clients...
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xl font-semibold">
                          {c.name?.trim() ? c.name : "(No name)"}
                        </div>
                        <Badge
                          className={
                            c.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
                              : "bg-white/10 text-white border-white/10"
                          }
                        >
                          {c.status ?? "UNKNOWN"}
                        </Badge>
                      </div>

                      <div className="mt-1 text-sm opacity-70">
                        {c.email?.trim() ? c.email : "No email"}
                      </div>

                      <div className="mt-1 text-xs opacity-60">
                        {c.industry?.trim() ? c.industry : "No industry"}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-sm">
                        <Badge
                          className={
                            c.calendar_connected
                              ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
                              : "bg-red-500/10 text-red-200 border-red-400/20"
                          }
                        >
                          {c.calendar_connected ? "Calendar Connected" : "Calendar Not connected"}
                        </Badge>

                        <Badge
                          className={
                            c.retell_connected
                              ? "bg-sky-500/15 text-sky-200 border-sky-400/20"
                              : "bg-red-500/10 text-red-200 border-red-400/20"
                          }
                        >
                          {c.retell_connected ? "Retell Connected" : "Retell Not connected"}
                        </Badge>

                        <Badge className="bg-white/10 border-white/10 text-white/80">
                          UUID OK
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/techops/clients/${c.id}`}>
                        <Button variant="secondary">View</Button>
                      </Link>
                      <Button
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deleteClient(c.id)}
                        disabled={busyId === c.id}
                      >
                        {busyId === c.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {clients.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm opacity-70">
                  No clients found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
