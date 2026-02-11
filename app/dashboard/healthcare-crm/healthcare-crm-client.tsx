"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Phone, Calendar, UserRound } from "lucide-react";

type HealthcareClient = {
  id: string;
  business_name: string | null;
  industry: string | null;
};

type HealthcarePatient = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  service_done: string;
  last_visit_date: string;
  next_visit_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  service_done: "",
  last_visit_date: "",
  next_visit_date: "",
  notes: "",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export default function HealthcareCrmClient({
  client,
  initialPatients,
}: {
  client: HealthcareClient;
  initialPatients: HealthcarePatient[];
}) {
  const [patients, setPatients] = useState<HealthcarePatient[]>(initialPatients);
  const [search, setSearch] = useState("");
  const searchTimerRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function getErrorMessage(err: unknown) {
    if (err instanceof Error) return err.message;
    return "Unexpected error.";
  }

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    };
  }, []);

  async function loadPatients(searchTerm = "") {
    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/healthcare/patients", window.location.origin);
      if (searchTerm) url.searchParams.set("search", searchTerm);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to load patients.");
        setLoading(false);
        return;
      }

      const json = await res.json();
      setPatients(Array.isArray(json?.patients) ? json.patients : []);
      setLoading(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  const totalPatients = useMemo(() => patients.length, [patients]);

  function handleSearchChange(value: string) {
    setSearch(value);

    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      loadPatients(value.trim());
    }, 250);
  }

  function openCreateModal() {
    setFormError(null);
    setForm(emptyForm);
    setShowCreateModal(true);
  }

  async function createPatient() {
    if (saving) return;

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch("/api/healthcare/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const text = await res.text();
        setFormError(text || "Failed to create patient.");
        setSaving(false);
        return;
      }

      setShowCreateModal(false);
      await loadPatients(search.trim());
      setSaving(false);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err));
      setSaving(false);
    }
  }

  async function removePatient(patient: HealthcarePatient) {
    const confirmed = window.confirm(`Remove client "${patient.full_name}"?`);
    if (!confirmed) return;

    setDeletingId(patient.id);
    setError(null);

    try {
      const res = await fetch(`/api/healthcare/patients/${patient.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to remove client.");
        setDeletingId(null);
        return;
      }

      setPatients((prev) => prev.filter((p) => p.id !== patient.id));
      setDeletingId(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950/60 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Healthcare CRM</h1>
            <div className="mt-1 text-sm opacity-70">
              {client.business_name || "Client"} • {client.industry || "-"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/client/dashboard">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </div>
        </div>

        <Card className="mt-6 border-white/10 bg-black/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <Search className="h-5 w-5" />
              Search Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <Label className="text-white/80">Name or phone number</Label>
                <Input
                  placeholder="Search by name or phone"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="mt-1 bg-black/30 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <Button variant="secondary" onClick={() => loadPatients(search.trim())} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
              <div className="text-sm opacity-70 text-left lg:text-right">{totalPatients} clients</div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          {patients.map((patient) => (
            <details
              key={patient.id}
              className="group rounded-2xl border border-white/10 bg-black/20 p-5 open:border-emerald-300/40 open:bg-black/40"
            >
              <summary className="list-none cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <UserRound className="h-4 w-4 opacity-80" />
                      <span className="truncate">{patient.full_name}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm opacity-80">
                      <Phone className="h-4 w-4" />
                      <span>{patient.phone}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm opacity-70">
                      <Calendar className="h-4 w-4" />
                      <span>Last visit: {formatDate(patient.last_visit_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removePatient(patient);
                      }}
                      className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                      disabled={deletingId === patient.id}
                    >
                      {deletingId === patient.id ? "Removing..." : "Remove Client"}
                    </button>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs opacity-80 group-open:opacity-100">
                      Expand
                    </div>
                  </div>
                </div>
              </summary>

              <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="opacity-60">Email</div>
                    <div className="break-all">{patient.email || "-"}</div>
                  </div>
                  <div>
                    <div className="opacity-60">Service done</div>
                    <div>{patient.service_done}</div>
                  </div>
                  <div>
                    <div className="opacity-60">Last visit date</div>
                    <div>{formatDate(patient.last_visit_date)}</div>
                  </div>
                  <div>
                    <div className="opacity-60">Next visit date</div>
                    <div>{formatDate(patient.next_visit_date)}</div>
                  </div>
                </div>
                <div>
                  <div className="opacity-60">Notes</div>
                  <div className="whitespace-pre-wrap break-words">{patient.notes || "-"}</div>
                </div>
              </div>
            </details>
          ))}

          {!loading && patients.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-6 text-center opacity-80">
              No clients found. Add your first client to start building your clinic CRM.
            </div>
          ) : null}
        </div>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="text-lg font-semibold">New Client</div>

            {formError ? (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {formError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 bg-black/30 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 bg-black/30 border-white/10 text-white"
                  />
                </div>
              </div>

              <div>
                <Label>Service Done *</Label>
                <Input
                  value={form.service_done}
                  onChange={(e) => setForm({ ...form, service_done: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                  placeholder="Cleaning, filling, root canal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Last Visit Date *</Label>
                  <Input
                    type="date"
                    value={form.last_visit_date}
                    onChange={(e) => setForm({ ...form, last_visit_date: e.target.value })}
                    className="mt-1 bg-black/30 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label>Next Visit Date</Label>
                  <Input
                    type="date"
                    value={form.next_visit_date}
                    onChange={(e) => setForm({ ...form, next_visit_date: e.target.value })}
                    className="mt-1 bg-black/30 border-white/10 text-white"
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                  placeholder="Additional information"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={createPatient} disabled={saving}>
                {saving ? "Saving..." : "Save Client"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
