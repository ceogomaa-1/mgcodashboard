'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  CreditCard,
  PhoneCall,
  Hash,
  CheckCircle,
  XCircle,
  Settings,
  Loader2
} from 'lucide-react';

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    const fetchClient = async () => {
      setLoading(true);
      
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/techops/login');
        return;
      }

      // Fetch client data - FRESH every time!
      const { data, error } = await supabase
        .from('clients')
        .select('*, integrations(*)')
        .eq('id', clientId)
        .single();

      if (error || !data) {
        router.push('/techops/dashboard');
        return;
      }

      setClient(data);
      setLoading(false);
    };

    fetchClient();
  }, [clientId]); // Re-fetch when clientId changes

  const getStatusColor = (status: string) => {
    const colors = {
      ACTIVE: 'bg-green-500/10 text-green-500 border-green-500/20',
      ONBOARDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      PAUSED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      CANCELED: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[status as keyof typeof colors] || colors.PAUSED;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl relative">
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

      <div className="container mx-auto px-6 py-8 space-y-8 relative">
        {/* Client Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-white">{client.business_name}</h1>
              <Badge className={getStatusColor(client.status)}>
                {client.status}
              </Badge>
            </div>
            <p className="text-slate-400">{client.industry}</p>
          </div>
          <Link href={`/techops/clients/${client.id}/edit`}>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300">
              <Settings className="w-4 h-4 mr-2" />
              Edit Client
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Client ID Card */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Hash className="w-5 h-5 text-blue-500" />
                  Client ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-sm text-slate-300 bg-slate-800/50 p-3 rounded border border-slate-700">
                  {client.id}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  This ID is visible to both TechOps and the client
                </p>
              </CardContent>
            </Card>

            {/* Contact Info Card */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-white">{client.owner_email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-white">{client.phone_number}</p>
                  </div>
                </div>
                {client.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="text-white">{client.address}</p>
                      {client.city && client.state && (
                        <p className="text-slate-400 text-sm">
                          {client.city}, {client.state} {client.zip_code}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Integrations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Retell Integration */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-blue-500" />
                    Retell AI Integration
                  </CardTitle>
                  {client.integrations?.retell_connected ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {client.integrations?.retell_connected ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Agent ID</p>
                      <p className="text-white font-mono text-sm">{client.integrations.retell_agent_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Phone Number</p>
                      <p className="text-white font-mono text-sm">{client.integrations.retell_phone_number}</p>
                    </div>
                    <Link href={`/techops/clients/${client.id}/integrations/retell`}>
                      <Button variant="outline" className="border-slate-600/50 bg-slate-800/50 text-slate-200 hover:text-white hover:bg-slate-700/70 transition-all duration-300">
                        Update Configuration
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-slate-400 mb-4">Retell AI is not connected yet</p>
                    <Link href={`/techops/clients/${client.id}/integrations/retell`}>
                      <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300">
                        Connect Retell AI
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Google Calendar Integration */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Google Calendar Integration
                  </CardTitle>
                  {client.integrations?.google_calendar_connected ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {client.integrations?.google_calendar_connected ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Calendar Email</p>
                      <p className="text-white font-mono text-sm">{client.integrations.google_calendar_email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Calendar ID</p>
                      <p className="text-white font-mono text-sm">{client.integrations.google_calendar_id}</p>
                    </div>
                    <Link href={`/techops/clients/${client.id}/integrations/calendar`}>
                      <Button variant="outline" className="border-slate-600/50 bg-slate-800/50 text-slate-200 hover:text-white hover:bg-slate-700/70 transition-all duration-300">
                        Update Configuration
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-slate-400 mb-4">Google Calendar is not connected yet</p>
                    <Link href={`/techops/clients/${client.id}/integrations/calendar`}>
                      <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300">
                        Connect Google Calendar
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Integration */}
            <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                    Stripe Integration
                  </CardTitle>
                  {client.integrations?.stripe_subscription_id ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active Subscription
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                      <XCircle className="w-3 h-3 mr-1" />
                      No Subscription
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {client.integrations?.stripe_subscription_id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Customer ID</p>
                      <p className="text-white font-mono text-sm">{client.integrations.stripe_customer_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Subscription ID</p>
                      <p className="text-white font-mono text-sm">{client.integrations.stripe_subscription_id}</p>
                    </div>
                    <Link href={`/techops/clients/${client.id}/integrations/stripe`}>
                      <Button variant="outline" className="border-slate-600/50 bg-slate-800/50 text-slate-200 hover:text-white hover:bg-slate-700/70 transition-all duration-300">
                        Manage Subscription
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-slate-400 mb-4">No active Stripe subscription</p>
                    <Link href={`/techops/clients/${client.id}/integrations/stripe`}>
                      <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300">
                        Create Subscription
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}