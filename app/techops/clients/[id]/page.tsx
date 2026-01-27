'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
} from 'lucide-react';

function normalizeClient(c: any) {
  const integ = Array.isArray(c?.integrations) ? (c.integrations[0] ?? null) : (c.integrations ?? null);
  return { ...c, integrations: integ };
}

function mask(value?: string | null) {
  if (!value) return '—';
  if (value.length <= 4) return '••••';
  return '••••••••••';
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
        <div className="text-sm font-mono text-white/90">{reveal ? value || '—' : mask(value)}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="border-white/15 bg-transparent text-white hover:bg-white/10"
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

  // Credentials modal state
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState<string | null>(null);

  const [creds, setCreds] = useState({
    retell_account_email: '',
    retell_account_password: '',
    automation_tools_email: '',
    automation_tools_password: '',
    google_credentials_email: '',
    google_credentials_password: '',
  });

  const [reveal, setReveal] = useState({
    retell_account_password: false,
    automation_tools_password: false,
    google_credentials_password: false,
  });

  useEffect(() => {
    const fetchClient = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/techops/login');
        return;
      }

      const { data, error } = await supabase.from('clients').select('*, integrations(*)').eq('id', clientId).single();

      if (error || !data) {
        router.push('/techops/dashboard');
        return;
      }

      setClient(normalizeClient(data));
      setLoading(false);
    };

    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const integration = useMemo(() => client?.integrations ?? null, [client]);

  // Prefill creds from integrations row
  useEffect(() => {
    if (!integration) return;

    setCreds({
      retell_account_email: integration.retell_account_email ?? '',
      retell_account_password: integration.retell_account_password ?? '',
      automation_tools_email: integration.automation_tools_email ?? '',
      automation_tools_password: integration.automation_tools_password ?? '',
      google_credentials_email: integration.google_credentials_email ?? '',
      google_credentials_password: integration.google_credentials_password ?? '',
    });
  }, [integration]);

  const saveCredentials = async () => {
    setSavingCreds(true);
    setCredsMsg(null);

    try {
      const res = await fetch(`/api/techops/clients/${clientId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setCredsMsg(json?.error || 'Failed to save.');
        setSavingCreds(false);
        return;
      }

      // Refresh client + integrations
      const { data, error } = await supabase.from('clients').select('*, integrations(*)').eq('id', clientId).single();
      if (!error && data) setClient(normalizeClient(data));

      setCredsMsg('Saved ✅');
      setSavingCreds(false);
    } catch (e: any) {
      setCredsMsg(e?.message ?? 'Failed to save.');
      setSavingCreds(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      ONBOARDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      PAUSED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      CANCELED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return map[status] || map.PAUSED;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!client) return null;

  // IMPORTANT: use the real flags from your original project
  const retellConnected = !!client.integrations?.retell_connected;
  const calendarConnected = !!client.integrations?.google_calendar_connected;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/techops/dashboard" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white">{client.business_name}</h1>
                <Badge className={statusBadge(client.status)}>{client.status}</Badge>
              </div>
              <p className="text-gray-500 text-sm">{client.owner_email}</p>
            </div>
          </div>

          <Link href={`/techops/clients/${client.id}/edit`}>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Settings className="w-4 h-4 mr-2" />
              Edit Client
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Business info */}
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Business Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-500">Industry</p>
                  <p className="text-gray-300">{client.industry || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-gray-300">{client.owner_email || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-gray-300">{client.phone_number || '—'}</p>
                </div>
              </div>

              {client.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-gray-300">{client.address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Integrations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Retell */}
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                  Retell AI
                </CardTitle>

                {retellConnected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                    <XCircle className="w-3 h-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-400">
                  {retellConnected ? (
                    <>
                      <div>
                        Agent ID:{' '}
                        <span className="text-gray-200 font-mono">{client.integrations?.retell_agent_id || '—'}</span>
                      </div>
                      <div>
                        Phone:{' '}
                        <span className="text-gray-200 font-mono">{client.integrations?.retell_phone_number || '—'}</span>
                      </div>
                    </>
                  ) : (
                    <div>Connect Retell so the client can see analytics + call performance.</div>
                  )}
                </div>

                {/* IMPORTANT: original working route (no 404) */}
                <Link href={`/techops/clients/${client.id}/integrations/retell`}>
                  <Button
                    className={
                      retellConnected
                        ? 'bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }
                  >
                    {retellConnected ? 'Manage' : 'Connect'}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Calendar */}
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  Google Calendar
                </CardTitle>

                {calendarConnected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                    <XCircle className="w-3 h-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-400">
                  {calendarConnected ? (
                    <>
                      <div>
                        Calendar ID:{' '}
                        <span className="text-gray-200 font-mono">{client.integrations?.google_calendar_id || '—'}</span>
                      </div>
                      <div>
                        Email:{' '}
                        <span className="text-gray-200 font-mono">{client.integrations?.google_calendar_email || '—'}</span>
                      </div>
                    </>
                  ) : (
                    <div>Connect Calendar so the client can see bookings inside the dashboard.</div>
                  )}
                </div>

                {/* IMPORTANT: original working route (no 404) */}
                <Link href={`/techops/clients/${client.id}/integrations/calendar`}>
                  <Button
                    className={
                      calendarConnected
                        ? 'bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }
                  >
                    {calendarConnected ? 'Manage' : 'Connect'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* TechOps-only Credentials (internal) */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="text-white text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                TechOps Credentials (internal)
              </div>

              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
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
              <div className="flex items-center gap-2 font-medium text-white">
                <MailCheck className="h-4 w-4 text-emerald-400" />
                Retell Account
              </div>
              <div className="mt-2 text-sm text-white/70">Email: {integration?.retell_account_email || '—'}</div>
              <div className="text-sm text-white/70">Pass: {integration?.retell_account_password ? 'Saved' : '—'}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 font-medium text-white">
                <Wand2 className="h-4 w-4 text-emerald-400" />
                Automation Tools (n8n/Make/Zapier)
              </div>
              <div className="mt-2 text-sm text-white/70">Email: {integration?.automation_tools_email || '—'}</div>
              <div className="text-sm text-white/70">Pass: {integration?.automation_tools_password ? 'Saved' : '—'}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 font-medium text-white">
                <MailCheck className="h-4 w-4 text-emerald-400" />
                Google Credentials
              </div>
              <div className="mt-2 text-sm text-white/70">Email: {integration?.google_credentials_email || '—'}</div>
              <div className="text-sm text-white/70">Pass: {integration?.google_credentials_password ? 'Saved' : '—'}</div>
            </div>
          </CardContent>
        </Card>

        {/* Modal */}
        {showCredsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold text-white">Manage TechOps Credentials</div>
                <Button
                  variant="outline"
                  className="border-white/15 bg-transparent text-white hover:bg-white/10"
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
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    placeholder="Retell email"
                    value={creds.retell_account_email}
                    onChange={(e) => setCreds((p) => ({ ...p, retell_account_email: e.target.value }))}
                  />
                  <SecretRow
                    label="Password"
                    value={creds.retell_account_password}
                    reveal={reveal.retell_account_password}
                    onToggle={() => setReveal((p) => ({ ...p, retell_account_password: !p.retell_account_password }))}
                  />
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    placeholder="Retell password"
                    type={reveal.retell_account_password ? 'text' : 'password'}
                    value={creds.retell_account_password}
                    onChange={(e) => setCreds((p) => ({ ...p, retell_account_password: e.target.value }))}
                  />
                </div>

                {/* Automation */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/80">Automation tools (n8n/Make/Zapier)</div>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    placeholder="Automation tools email"
                    value={creds.automation_tools_email}
                    onChange={(e) => setCreds((p) => ({ ...p, automation_tools_email: e.target.value }))}
                  />
                  <SecretRow
                    label="Password"
                    value={creds.automation_tools_password}
                    reveal={reveal.automation_tools_password}
                    onToggle={() =>
                      setReveal((p) => ({ ...p, automation_tools_password: !p.automation_tools_password }))
                    }
                  />
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    placeholder="Automation tools password"
                    type={reveal.automation_tools_password ? 'text' : 'password'}
                    value={creds.automation_tools_password}
                    onChange={(e) => setCreds((p) => ({ ...p, automation_tools_password: e.target.value }))}
                  />
                </div>

                {/* Google */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/80">Google credentials</div>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    placeholder="Google email"
                    value={creds.google_credentials_email}
                    onChange={(e) => setCreds((p) => ({ ...p, google_credentials_email: e.target.value }))}
                  />
                  <SecretRow
                    label="Password"
                    value={creds.google_credentials_password}
                    reveal={reveal.google_credentials_password}
                    onToggle={() =>
                      setReveal((p) => ({ ...p, google_credentials_password: !p.google_credentials_password }))
                    }
                  />
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    placeholder="Google password"
                    type={reveal.google_credentials_password ? 'text' : 'password'}
                    value={creds.google_credentials_password}
                    onChange={(e) => setCreds((p) => ({ ...p, google_credentials_password: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-sm text-white/60">{credsMsg || ''}</div>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" disabled={savingCreds} onClick={saveCredentials}>
                    {savingCreds ? 'Saving...' : 'Save'}
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
