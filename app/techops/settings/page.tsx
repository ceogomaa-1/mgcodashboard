'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Key, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Settings() {
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [retellApiKey, setRetellApiKey] = useState('');

  useEffect(() => {
  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'retell_api_key')
        .maybeSingle();

      if (error) throw error;

      setRetellApiKey(data?.value || '');
    } catch (err: any) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  fetchConfig();
}, []);

  const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  setError('');
  setSuccess(false);

  try {
    const { error } = await supabase
      .from('platform_settings')
      .update({
        value: retellApiKey,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'retell_api_key');

    if (error) throw error;

    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  } catch (err: any) {
    console.error('Error saving config:', err);
    setError(err.message || 'Failed to save API key');
  } finally {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <Link 
            href="/techops/dashboard"
            className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Platform Settings</h1>
          <p className="text-slate-400">Configure API keys and integrations</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-green-500 font-medium">Success!</p>
              <p className="text-green-400 text-sm">API key has been saved</p>
            </div>
          </div>
        )}

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-500" />
              Retell AI Configuration
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your Retell AI API key to enable real-time call data across all clients
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

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="retell_api_key" className="text-white">
                  Retell API Key
                </Label>
                <Input
                  id="retell_api_key"
                  type="password"
                  value={retellApiKey}
                  onChange={(e) => setRetellApiKey(e.target.value)}
                  placeholder="sk_live_xxxxxxxxxxxxx"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                />
                <p className="text-xs text-slate-500">
                  This key will be used to fetch real-time data for all clients
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4">
                <h4 className="text-white font-medium mb-2">How to get your API key:</h4>
                <ol className="text-slate-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Log in to your Retell AI dashboard</li>
                  <li>Go to Settings → API Keys</li>
                  <li>Create a new API key or copy an existing one</li>
                  <li>Paste it above</li>
                </ol>
              </div>

              <Button 
                type="submit" 
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save API Key'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}