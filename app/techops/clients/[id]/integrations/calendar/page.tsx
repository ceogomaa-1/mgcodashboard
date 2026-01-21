'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ConnectCalendar() {
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [clientName, setClientName] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const [formData, setFormData] = useState({
    google_calendar_id: '',
    google_calendar_email: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: client } = await supabase
          .from('clients')
          .select('business_name')
          .eq('id', clientId)
          .single();

        if (client) setClientName(client.business_name);

        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();

        if (integration) {
          setIsConnected(!!integration.google_calendar_connected);
          setFormData({
            google_calendar_id: integration.google_calendar_id || '',
            google_calendar_email: integration.google_calendar_email || '',
          });
        } else {
          setIsConnected(false);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to load integration');
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('integrations')
        .upsert(
          {
            client_id: clientId,
            google_calendar_id: formData.google_calendar_id,
            google_calendar_email: formData.google_calendar_email,
            google_calendar_connected: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' }
        );

      if (error) throw error;

      setSuccess(true);
      setIsConnected(true);

      setTimeout(() => {
        window.location.href = `/techops/clients/${clientId}`;
      }, 900);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to connect calendar');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar for this client?')) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('integrations')
        .upsert(
          {
            client_id: clientId,
            google_calendar_id: null,
            google_calendar_email: null,
            google_calendar_connected: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' }
        );

      if (error) throw error;

      setFormData({ google_calendar_id: '', google_calendar_email: '' });
      setIsConnected(false);
      setSuccess(true);

      setTimeout(() => {
        window.location.href = `/techops/clients/${clientId}`;
      }, 900);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <Link href={`/techops/clients/${clientId}`} className="inline-flex items-center text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Client Details
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Google Calendar • {clientName || 'Client'}
            </CardTitle>
            <CardDescription className="text-gray-500">
              {isConnected ? 'Connected — update details or disconnect.' : 'Connect calendar metadata for this client.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {success && (
              <div className="flex items-start gap-3 p-3 border border-emerald-500/20 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-emerald-300 font-medium">Saved</p>
                  <p className="text-emerald-200/80 text-sm">Redirecting…</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-3 border border-red-500/20 rounded-lg bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">Error</p>
                  <p className="text-red-200/80 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="google_calendar_id" className="text-white">Google Calendar ID *</Label>
                <Input
                  id="google_calendar_id"
                  value={formData.google_calendar_id}
                  onChange={(e) => handleChange('google_calendar_id', e.target.value)}
                  placeholder="primary or calendarId@group.calendar.google.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_calendar_email" className="text-white">Google Calendar Email *</Label>
                <Input
                  id="google_calendar_email"
                  type="email"
                  value={formData.google_calendar_email}
                  onChange={(e) => handleChange('google_calendar_email', e.target.value)}
                  placeholder="calendar@email.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                {isConnected ? (
                  <Button
                    type="button"
                    onClick={handleDisconnect}
                    variant="outline"
                    className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    disabled={saving}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <div />
                )}

                <Button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    isConnected ? 'Save Changes' : 'Connect Calendar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
