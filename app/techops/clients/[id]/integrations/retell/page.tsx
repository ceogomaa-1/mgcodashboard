'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, PhoneCall, AlertCircle, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ConnectRetell() {
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const [formData, setFormData] = useState({
    retell_agent_id: '',
    retell_phone_number: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check if master API key exists
        const { data: settingsData } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'retell_api_key')
          .maybeSingle();

        if (!settingsData?.value) {
          setApiKeyMissing(true);
        }

        // Fetch client info
        const { data: client } = await supabase
          .from('clients')
          .select('business_name')
          .eq('id', clientId)
          .single();

        if (client) {
          setClientName(client.business_name);
        }

        // Fetch existing integration
        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('client_id', clientId)
          .single();

        if (integration) {
          setIsConnected(integration.retell_connected || false);
          setFormData({
            retell_agent_id: integration.retell_agent_id || '',
            retell_phone_number: integration.retell_phone_number || '',
          });
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load integration data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
        .update({
          retell_agent_id: formData.retell_agent_id,
          retell_phone_number: formData.retell_phone_number,
          retell_connected: true,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId);

      if (error) throw error;

      setSuccess(true);
      setIsConnected(true);
      
      setTimeout(() => {
  window.location.href = `/techops/clients/${clientId}`;
}, 1500);
    } catch (err: any) {
      console.error('Error updating integration:', err);
      setError(err.message || 'Failed to connect Retell AI');
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Retell AI? This will stop all AI phone functionality for this client.')) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error } = await supabase
        .from('integrations')
        .update({
          retell_agent_id: null,
          retell_phone_number: null,
          retell_connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId);

      if (error) throw error;

      setFormData({
        retell_agent_id: '',
        retell_phone_number: '',
      });
      setIsConnected(false);
      setSaving(false);
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.message || 'Failed to disconnect Retell AI');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (apiKeyMissing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
          <div className="container mx-auto px-6 py-4">
            <Link 
              href={`/techops/clients/${clientId}`}
              className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Client Details
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8 max-w-3xl">
          <Card className="border-red-700 bg-red-500/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                API Key Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300">
                Before you can connect clients to Retell AI, you need to configure your master Retell API key.
              </p>
              <p className="text-slate-400 text-sm">
                This API key allows the platform to fetch real-time call data for all your clients.
              </p>
              <Link href="/techops/settings">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Go to Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <Link 
            href={`/techops/clients/${clientId}`}
            className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Client Details
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <PhoneCall className="w-8 h-8 text-blue-500" />
            Retell AI Integration
          </h1>
          <p className="text-slate-400">Configure Retell AI for {clientName}</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-green-500 font-medium">Success!</p>
              <p className="text-green-400 text-sm">Retell AI has been connected. Redirecting...</p>
            </div>
          </div>
        )}

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Connection Details</CardTitle>
            <CardDescription className="text-slate-400">
              Assign a Retell AI agent to this client. The platform will automatically fetch real-time call data using your master API key.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-red-500 font-medium">Error</p>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agent ID */}
              <div className="space-y-2">
                <Label htmlFor="retell_agent_id" className="text-white">
                  Retell Agent ID *
                </Label>
                <Input
                  id="retell_agent_id"
                  value={formData.retell_agent_id}
                  onChange={(e) => handleChange('retell_agent_id', e.target.value)}
                  placeholder="agent_xxxxxxxxxxxxx"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                  required
                />
                <p className="text-xs text-slate-500">
                  The unique identifier for this client's AI agent in Retell
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="retell_phone_number" className="text-white">
                  Retell Phone Number *
                </Label>
                <Input
                  id="retell_phone_number"
                  type="tel"
                  value={formData.retell_phone_number}
                  onChange={(e) => handleChange('retell_phone_number', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
                <p className="text-xs text-slate-500">
                  The phone number assigned to this client's AI agent
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-blue-500" />
                  How to get these credentials:
                </h4>
                <ol className="text-slate-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Log in to your Retell AI dashboard</li>
                  <li>Navigate to the Agents section</li>
                  <li>Create or select an agent for "{clientName}"</li>
                  <li>Copy the Agent ID from the agent details</li>
                  <li>Assign a phone number to the agent</li>
                  <li>Paste both values above</li>
                </ol>
                <p className="text-xs text-slate-500 mt-3">
                  💡 The platform will use your master API key (saved in Settings) to automatically fetch call data for this agent.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                {isConnected && (
                  <Button 
                    type="button"
                    onClick={handleDisconnect}
                    disabled={saving}
                    variant="outline"
                    className="border-red-600 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect Retell AI'
                    )}
                  </Button>
                )}
                <Link href={`/techops/clients/${clientId}`} className="flex-1">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="w-full border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    isConnected ? 'Update Connection' : 'Connect Retell AI'
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