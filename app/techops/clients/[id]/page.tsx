"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Settings,
  PhoneCall,
  Calendar,
  CheckCircle,
  XCircle,
  KeyRound,
  Shield,
  Wand2,
  MailCheck,
  Eye,
  EyeOff,
} from "lucide-react";

function normalizeClient(c: any) {
  const integ = Array.isArray(c?.integrations)
    ? c.integrations[0] ?? null
    : c.integrations ?? null;
  return { ...c, integrations: integ };
}

function mask(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return "••••••••••";
}

function SecretRow({
  label,
  value,
  reveal,
  onToggle,
}: {
  label: string;
  value: string;
  reveal: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-sm text-white/70">{label}</div>
      <div className="flex items-center gap-2">
        <div className="text-sm font-mono text-white/90">
          {reveal ? value || "—" : mask(value)}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="border-white/15 bg-transparent"
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function TechOpsClientDetails() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);

  // TechOps credentials modal + state
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState<string | null>(null);

  const [creds, setCreds] = useState({
    retell_account_email: "",
    retell_account_password: "",
    automation_tools_email: "",
    automation_tools_password: "",
    google_credentials_email: "",
    google_credentials_password: "",
  });

  const [reveal, setReveal] = useState({
    retell_account_password: false,
    automation_tools_password: false,
    google_credentials_password: false,
  });

  const integration = useMemo(() => client?.integrations ?? null, [client]);

  useEffect(() => {
    const fetchClient = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/techops/login");
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("*, integrations(*)")
        .eq("id", clientId)
        .single();

      if (!error) setClient(normalizeClient(data));
      setLoading(false);
    };

    fetchClient();
  }, [clientId, router, supabase]);

  // Prefill creds from integrations row
  useEffect(() => {
    if (!integration) return;

    setCreds({
      retell_account_email: integration.retell_account_email ?? "",
      retell_account_password: integration.retell_account_password ?? "",
      automation_tools_email: integration.automation_tools_email ?? "",
      automation_tools_password: integration.automation_tools_password ?? "",
      google_credentials_email: integration.google_credentials_email ?? "",
      google_credentials_password: integration.google_credentials_password ?? "",
    });
  }, [integration]);

  const refreshClient = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*, integrations(*)")
      .eq("id", clientId)
      .single();

    if (!error) setClient(normalizeClient(data));
  };

  const saveCredentials = async () => {
    setSavingCreds(true);
    setCredsMsg(null);

    try {
      const res = await fetch(`/api/techops/clients/${clientId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setCredsMsg(json?.error || "Failed to save.");
        setSavingCreds(false);
        return;
      }

      await refreshClient();
      setCredsMsg("Saved ✅");
      setSavingCreds(false);
    } catch (e: any) {
      setCredsMsg(e?.message ?? "Failed to save.");
      setSavingCreds(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Loading…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-white/70 mb-4">Client not found.</div>
          <Link href="/techops/clients">
            <Button variant="outline" className="border-white/15 bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusActive = client?.status?.toLowerCase() === "active";

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/techops/clients">
              <Button variant="outline" className="border-white/15 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {client.business_name || "Client"}
                </h1>
                <Badge className={statusActive ? "bg-emerald-600" : "bg-zinc-700"}>
                  {statusActive ? "ACTIVE" : client.status || "UNKNOWN"}
                </Badge>
              </div>
              <div className="text-white/60 text-sm">{client.email || "—"}</div>
            </div>
          </div>

          <Link href={`/techops/clients/${clientId}/edit`}>
            <Button className="bg-emerald-600 hover:bg-emerald-500">
              <Settings className="h-4 w-4 mr-2" />
              Edit Client
            </Button>
          </Link>
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Info */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-400" />
                Business Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-white/80">
              <div className="flex items-center gap-2">
                <span className="text-white/60 w-24">Industry</span>
                <span>{client.industry || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-white/50" />
                <span>{client.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-white/50" />
                <span>{client.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white/50" />
                <span>{client.address || "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <div className="space-y-6">
            {/* Retell */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-5 w-5 text-emerald-400" />
                    Retell AI
                  </div>
                  <Badge className={integration?.retell_api_key ? "bg-emerald-600" : "bg-zinc-700"}>
                    {integration?.retell_api_key ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-4 w-4" /> Not connected
                      </span>
                    )}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white/80">
                <div className="text-sm text-white/60">
                  Agent ID: {integration?.retell_agent_id || "—"}
                </div>
                <div className="text-sm text-white/60">
                  Phone: {integration?.retell_phone || "—"}
                </div>
                <div className="mt-3 flex justify-end">
                  <Link href={`/techops/clients/${clientId}/retell`}>
                    <Button variant="outline" className="border-white/15 bg-transparent">
                      Manage
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Google Calendar */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-emerald-400" />
                    Google Calendar
                  </div>
                  <Badge
                    className={integration?.google_calendar_id ? "bg-emerald-600" : "bg-zinc-700"}
                  >
                    {integration?.google_calendar_id ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-4 w-4" /> Not connected
                      </span>
                    )}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white/80">
                <div className="text-sm text-white/60">
                  Calendar ID: {integration?.google_calendar_id || "—"}
                </div>
                <div className="text-sm text-white/60">
                  Email: {integration?.google_calendar_email || "—"}
                </div>
                <div className="mt-3 flex justify-end">
                  <Link href={`/techops/clients/${clientId}/calendar`}>
                    <Button variant="outline" className="border-white/15 bg-transparent">
                      Manage
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ✅ NEW: TechOps Credentials section (THIS is what you want to see) */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                TechOps Credentials (internal)
              </div>

              <Button
                className="bg-emerald-600 hover:bg-emerald-500"
                onClick={() => {
                  setCredsMsg(null);
                  setShowCredsModal(true);
                }}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Manage Credentials
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 font-medium">
                <MailCheck className="h-4 w-4 text-emerald-400" />
                Retell Account
              </div>
              <div className="mt-2 text-sm text-white/60">
                Email: {integration?.retell_account_email || "—"}
              </div>
              <div className="text-sm text-white/60">
                Pass: {integration?.retell_account_password ? "Saved" : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Wand2 className="h-4 w-4 text-emerald-400" />
                Automation Tools
              </div>
              <div className="mt-2 text-sm text-white/60">
                Email: {integration?.automation_tools_email || "—"}
              </div>
              <div className="text-sm text-white/60">
                Pass: {integration?.automation_tools_password ? "Saved" : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 font-medium">
                <MailCheck className="h-4 w-4 text-emerald-400" />
                Google Credentials
              </div>
              <div className="mt-2 text-sm text-white/60">
                Email: {integration?.google_credentials_email || "—"}
              </div>
              <div className="text-sm text-white/60">
                Pass: {integration?.google_credentials_password ? "Saved" : "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal */}
        {showCredsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold">Manage TechOps Credentials</div>
                <Button
                  variant="outline"
                  className="border-white/15 bg-transparent"
                  onClick={() => setShowCredsModal(false)}
                >
                  Close
                </Button>
              </div>

              <div className="space-y-5">
                {/* Retell */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/80">Retell AI account</div>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    placeholder="Retell email"
                    value={creds.retell_account_email}
                    onChange={(e) =>
                      setCreds((p) => ({ ...p, retell_account_email: e.target.value }))
                    }
                  />

                  <SecretRow
                    label="Password"
                    value={creds.retell_account_password}
                    reveal={reveal.retell_account_password}
                    onToggle={() =>
                      setReveal((p) => ({
                        ...p,
                        retell_account_password: !p.retell_account_password,
                      }))
                    }
                  />

                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    placeholder="Retell password"
                    type={reveal.retell_account_password ? "text" : "password"}
                    value={creds.retell_account_password}
                    onChange={(e) =>
                      setCreds((p) => ({ ...p, retell_account_password: e.target.value }))
                    }
                  />
                </div>

                {/* Automation */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/80">
                    Automation tools (n8n/Make/Zapier)
                  </div>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    placeholder="Automation tools email"
                    value={creds.automation_tools_email}
                    onChange={(e) =>
                      setCreds((p) => ({ ...p, automation_tools_email: e.target.value }))
                    }
                  />

                  <SecretRow
                    label="Password"
                    value={creds.automation_tools_password}
                    reveal={reveal.automation_tools_password}
                    onToggle={() =>
                      setReveal((p) => ({
                        ...p,
                        automation_tools_password: !p.automation_tools_password,
                      }))
                    }
                  />

                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    placeholder="Automation tools password"
                    type={reveal.automation_tools_password ? "text" : "password"}
                    value={creds.automation_tools_password}
                    onChange={(e) =>
                      setCreds((p) => ({ ...p, automation_tools_password: e.target.value }))
                    }
                  />
                </div>

                {/* Google */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/80">Google credentials</div>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    placeholder="Google email"
                    value={creds.google_credentials_email}
                    onChange={(e) =>
                      setCreds((p) => ({ ...p, google_credentials_email: e.target.value }))
                    }
                  />

                  <SecretRow
                    label="Password"
                    value={creds.google_credentials_password}
                    reveal={reveal.google_credentials_password}
                    onToggle={() =>
                      setReveal((p) => ({
                        ...p,
                        google_credentials_password: !p.google_credentials_password,
                      }))
                    }
                  />

                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                    placeholder="Google password"
                    type={reveal.google_credentials_password ? "text" : "password"}
                    value={creds.google_credentials_password}
                    onChange={(e) =>
                      setCreds((p) => ({ ...p, google_credentials_password: e.target.value }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-sm text-white/60">{credsMsg || ""}</div>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500"
                    disabled={savingCreds}
                    onClick={saveCredentials}
                  >
                    {savingCreds ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
