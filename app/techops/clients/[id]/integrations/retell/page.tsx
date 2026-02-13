'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, PhoneCall, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ConnectRetell() {
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [clientName, setClientName] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const [formData, setFormData] = useState({
    retell_api_key: '',
    retell_public_api_key: '',
    retell_agent_id: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Client name
        const { data: client } = await supabase
          .from('clients')
          .select('business_name')
          .eq('id', clientId)
          .single();

        if (client) setClientName(client.business_name);

        // Existing integration (may not exist)
        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();

        if (integration) {
          setIsConnected(!!integration.retell_connected);
          setFormData({
            retell_api_key: integration.retell_api_key || '',
            retell_public_api_key: integration.retell_public_api_key || '',
            retell_agent_id: integration.retell_agent_id || '',
          });
        } else {
          setIsConnected(false);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
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
      const apiKey = formData.retell_api_key.trim();
      const publicApiKey = formData.retell_public_api_key.trim();
      const agentId = formData.retell_agent_id.trim();

      if (!apiKey.startsWith('key_')) {
        setError('Retell API key must start with "key_".');
        setSaving(false);
        return;
      }

      if (!agentId) {
        setError('Retell Agent ID is required.');
        setSaving(false);
        return;
      }

      if (!publicApiKey.startsWith('public_key_')) {
        setError('Retell Public API key must start with "public_key_".');
        setSaving(false);
        return;
      }

      // IMPORTANT: Upsert so we never silently update 0 rows
      const { error } = await supabase
        .from('integrations')
        .upsert(
          {
            client_id: clientId,
            retell_api_key: apiKey,
            retell_public_api_key: publicApiKey,
            retell_agent_id: agentId,
            retell_connected: true,
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
      console.error('Error updating integration:', err);
      setError(err?.message || 'Failed to connect Retell AI');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Retell AI for this client?')) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // Upsert false (works even if row didn’t exist)
      const { error } = await supabase
        .from('integrations')
        .upsert(
          {
            client_id: clientId,
            retell_api_key: null,
            retell_public_api_key: null,
            retell_agent_id: null,
            retell_phone_number: null,
            retell_connected: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' }
        );

      if (error) throw error;

      setFormData({ retell_api_key: '', retell_public_api_key: '', retell_agent_id: '' });
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

      <div className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-400" />
              Retell AI • {clientName || 'Client'}
            </CardTitle>
            <CardDescription className="text-gray-500">
              {isConnected ? 'Connected. Update API key or agent ID anytime.' : 'Enter the client Retell API key and agent ID.'}
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
                <Label htmlFor="retell_api_key" className="text-white">Retell API Key *</Label>
                <Input
                  id="retell_api_key"
                  type="password"
                  value={formData.retell_api_key}
                  onChange={(e) => handleChange('retell_api_key', e.target.value)}
                  placeholder="key_xxxxxxxxxxxxx"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retell_agent_id" className="text-white">Retell Agent ID *</Label>
                <Input
                  id="retell_agent_id"
                  value={formData.retell_agent_id}
                  onChange={(e) => handleChange('retell_agent_id', e.target.value)}
                  placeholder="agent_xxxxxxxxxxxxx"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retell_public_api_key" className="text-white">Retell Public API Key *</Label>
                <Input
                  id="retell_public_api_key"
                  type="password"
                  value={formData.retell_public_api_key}
                  onChange={(e) => handleChange('retell_public_api_key', e.target.value)}
                  placeholder="public_key_xxxxxxxxxxxxx"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 font-mono"
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
                    isConnected ? 'Save Changes' : 'Connect Retell AI'
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
