'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, AlertCircle, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ConnectCalendar() {
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
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
          setIsConnected(integration.google_calendar_connected || false);
          setFormData({
            google_calendar_id: integration.google_calendar_id || '',
            google_calendar_email: integration.google_calendar_email || '',
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
          google_calendar_id: formData.google_calendar_id,
          google_calendar_email: formData.google_calendar_email,
          google_calendar_connected: true,
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
      setError(err.message || 'Failed to connect Google Calendar');
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? This will stop all calendar sync functionality for this client.')) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error } = await supabase
        .from('integrations')
        .update({
          google_calendar_id: null,
          google_calendar_email: null,
          google_calendar_connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId);

      if (error) throw error;

      setFormData({
        google_calendar_id: '',
        google_calendar_email: '',
      });
      setIsConnected(false);
      setSaving(false);
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.message || 'Failed to disconnect Google Calendar');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl relative">
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

      <div className="container mx-auto px-6 py-8 max-w-3xl relative">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
            Google Calendar Integration
          </h1>
          <p className="text-slate-400">Configure Google Calendar for {clientName}</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3 backdrop-blur">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-green-500 font-medium">Success!</p>
              <p className="text-green-400 text-sm">Google Calendar has been connected. Redirecting...</p>
            </div>
          </div>
        )}

        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Connection Details</CardTitle>
            <CardDescription className="text-slate-400">
              Connect this client's Google Calendar to enable automated appointment scheduling and calendar sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-red-500 font-medium">Error</p>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Calendar Email */}
              <div className="space-y-2">
                <Label htmlFor="google_calendar_email" className="text-white">
                  Google Calendar Email *
                </Label>
                <Input
                  id="google_calendar_email"
                  type="email"
                  value={formData.google_calendar_email}
                  onChange={(e) => handleChange('google_calendar_email', e.target.value)}
                  placeholder="calendar@example.com"
                  className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50"
                  required
                />
                <p className="text-xs text-slate-500">
                  The Google account email that owns the calendar
                </p>
              </div>

              {/* Calendar ID */}
              <div className="space-y-2">
                <Label htmlFor="google_calendar_id" className="text-white">
                  Google Calendar ID *
                </Label>
                <Input
                  id="google_calendar_id"
                  value={formData.google_calendar_id}
                  onChange={(e) => handleChange('google_calendar_id', e.target.value)}
                  placeholder="calendar-id@group.calendar.google.com"
                  className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 font-mono focus:border-blue-500/50"
                  required
                />
                <p className="text-xs text-slate-500">
                  The unique identifier for this calendar in Google Calendar
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  How to get the Calendar ID:
                </h4>
                <ol className="text-slate-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Open Google Calendar on desktop</li>
                  <li>Click on the calendar name in the left sidebar</li>
                  <li>Go to "Settings and sharing"</li>
                  <li>Scroll down to "Integrate calendar"</li>
                  <li>Copy the "Calendar ID" (looks like an email)</li>
                  <li>Paste it above</li>
                </ol>
                <p className="text-xs text-slate-500 mt-3">
                  💡 The client must grant MG&CO access to their calendar for this to work.
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
                    className="border-red-600/50 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect Calendar'
                    )}
                  </Button>
                )}
                <Link href={`/techops/clients/${clientId}`} className="flex-1">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="w-full border-slate-600/50 bg-slate-800/50 text-slate-200 hover:text-white hover:bg-slate-700/70 transition-all duration-300"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    isConnected ? 'Update Connection' : 'Connect Calendar'
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