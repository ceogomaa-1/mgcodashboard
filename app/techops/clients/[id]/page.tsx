'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { ArrowLeft, Building2, Mail, Phone, MapPin, Settings, PhoneCall, Calendar, CheckCircle, XCircle } from 'lucide-react';

function normalizeClient(c: any) {
  const integ = Array.isArray(c?.integrations) ? (c.integrations[0] ?? null) : (c.integrations ?? null);
  return { ...c, integrations: integ };
}

export default function TechOpsClientDetails() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    const fetchClient = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/techops/login');
        return;
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*, integrations(*)')
        .eq('id', clientId)
        .single();

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

      <div className="container mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <p className="text-gray-300">{client.industry}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-500 mt-1" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-gray-300">{client.owner_email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gray-500 mt-1" />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-gray-300">{client.phone_number}</p>
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
                    <div>Agent ID: <span className="text-gray-200 font-mono">{client.integrations?.retell_agent_id || '—'}</span></div>
                    <div>Phone: <span className="text-gray-200 font-mono">{client.integrations?.retell_phone_number || '—'}</span></div>
                  </>
                ) : (
                  <div>Connect Retell so the client can see analytics + call performance.</div>
                )}
              </div>

              <Link href={`/techops/clients/${client.id}/integrations/retell`}>
                <Button className={retellConnected ? 'bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}>
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
                    <div>Calendar ID: <span className="text-gray-200 font-mono">{client.integrations?.google_calendar_id || '—'}</span></div>
                    <div>Email: <span className="text-gray-200 font-mono">{client.integrations?.google_calendar_email || '—'}</span></div>
                  </>
                ) : (
                  <div>Connect Calendar so the client can see bookings inside the dashboard.</div>
                )}
              </div>

              <Link href={`/techops/clients/${client.id}/integrations/calendar`}>
                <Button className={calendarConnected ? 'bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}>
                  {calendarConnected ? 'Manage' : 'Connect'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
