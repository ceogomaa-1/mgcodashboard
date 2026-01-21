"use client";

import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  name: string | null;
  email: string | null;
  industry: string | null;
  status: "ACTIVE" | "ONBOARDING" | "NEEDS_ATTENTION" | string;
  retell_connected?: boolean | null;
  calendar_connected?: boolean | null;
};

export default function TechOpsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function loadClients() {
    setLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/techops/clients/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load clients");
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (e: any) {
      console.error(e);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const a = (c.name || "").toLowerCase();
      const b = (c.email || "").toLowerCase();
      const d = (c.industry || "").toLowerCase();
      return a.includes(q) || b.includes(q) || d.includes(q);
    });
  }, [clients, search]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "ACTIVE").length;
    const onboarding = clients.filter((c) => c.status === "ONBOARDING").length;
    const needs = clients.filter((c) => c.status === "NEEDS_ATTENTION").length;
    return { total, active, onboarding, needs };
  }, [clients]);

  function openDelete(c: ClientRow) {
    setDeleteError(null);
    setDeleteTarget(c);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    setDeleteError(null);

    const id = deleteTarget?.id;
    if (!id) {
      setDeleteError("Missing client id (UI bug). Refresh and try again.");
      return;
    }

    setDeleteBusy(true);
    try {
      const res = await fetch("/api/techops/clients/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: id }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Delete failed");
      }

      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadClients();
    } catch (e: any) {
      setDeleteError(e?.message || "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold">TechOps Dashboard</h1>
            <p className="mt-1 text-white/60">Manage clients + integrations</p>
          </div>

          <button className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400">
            + Add Client
          </button>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Total Clients" value={stats.total} />
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Onboarding" value={stats.onboarding} />
          <StatCard label="Needs Attention" value={stats.needs} />
        </div>

        {/* List */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Clients</h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / email / industry..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none md:w-[360px]"
            />
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="text-white/60">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-white/60">No clients found.</div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="truncate text-lg font-semibold">
                        {c.name || "client"}
                      </div>

                      <StatusPill status={c.status} />
                    </div>

                    <div className="mt-1 truncate text-sm text-white/60">
                      {c.email || "—"} {c.industry ? `• ${c.industry}` : ""}
                    </div>

                    <div className="mt-2 text-sm text-white/50">
                      Retell:{" "}
                      {c.retell_connected ? (
                        <span className="text-emerald-400">Connected</span>
                      ) : (
                        <span className="text-white/50">Not</span>
                      )}{" "}
                      • Calendar:{" "}
                      {c.calendar_connected ? (
                        <span className="text-emerald-400">Connected</span>
                      ) : (
                        <span className="text-white/50">Not</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <a
                      href={`/techops/clients/${c.id}`}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
                    >
                      View
                    </a>

                    <button
                      onClick={() => openDelete(c)}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/15"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0b] p-6">
            <h3 className="text-xl font-semibold">Delete client?</h3>
            <p className="mt-2 text-white/60">
              This will permanently delete{" "}
              <span className="text-white">
                {deleteTarget?.name || deleteTarget?.email || "this client"}
              </span>{" "}
              from the database (and their related rows).
            </p>

            {deleteError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
                disabled={deleteBusy}
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                disabled={deleteBusy}
              >
                {deleteBusy ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "ACTIVE"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
      : status === "ONBOARDING"
      ? "bg-yellow-500/15 text-yellow-200 border-yellow-500/20"
      : status === "NEEDS_ATTENTION"
      ? "bg-red-500/15 text-red-200 border-red-500/20"
      : "bg-white/10 text-white/70 border-white/10";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${style}`}>
      {status}
    </span>
  );
}
