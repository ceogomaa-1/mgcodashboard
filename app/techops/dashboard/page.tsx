'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus,
  Phone,
  Calendar,
  CreditCard,
  LogOut,
  Settings,
  TrendingUp,
  Activity,
  Search
} from 'lucide-react';

export default function TechOpsDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/techops/login');
        return;
      }
      setUser(user);

      // Fetch clients
      const { data } = await supabase
        .from('clients')
        .select('*, integrations(*)')
        .order('created_at', { ascending: false });

      setClients(data || []);
      setFilteredClients(data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client =>
        client.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  const totalClients = clients?.length || 0;
  const activeClients = clients?.filter(c => c.status === 'ACTIVE').length || 0;
  const onboardingClients = clients?.filter(c => c.status === 'ONBOARDING').length || 0;

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
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              MG&CO TechOps
            </h1>
            <p className="text-slate-400 text-sm">{user?.email}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/techops/settings">
              <Button 
                variant="outline" 
                className="border-slate-600/50 bg-slate-800/50 text-slate-200 hover:text-white hover:bg-slate-700/70 hover:border-blue-500/50 transition-all duration-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
            <form action="/auth/signout" method="post">
              <Button 
                variant="outline" 
                className="border-slate-600/50 bg-slate-800/50 text-slate-200 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8 relative">
        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">Dashboard</h2>
            <p className="text-slate-400 mt-1">Manage clients and integrations</p>
          </div>
          <Link href="/techops/clients/new">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105">
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Clients */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Total Clients
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white group-hover:scale-105 transition-transform">
                {totalClients}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <p className="text-xs text-slate-500">All time</p>
              </div>
            </CardContent>
          </Card>

          {/* Active Clients */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl hover:border-green-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Active
              </CardTitle>
              <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white group-hover:scale-105 transition-transform">
                {activeClients}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Activity className="w-3 h-3 text-green-500" />
                <p className="text-xs text-slate-500">Currently active</p>
              </div>
            </CardContent>
          </Card>

          {/* Onboarding */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl hover:border-yellow-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Onboarding
              </CardTitle>
              <div className="p-2 rounded-lg bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-colors">
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white group-hover:scale-105 transition-transform">
                {onboardingClients}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3 text-yellow-500" />
                <p className="text-xs text-slate-500">In progress</p>
              </div>
            </CardContent>
          </Card>

          {/* Open Tickets */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl hover:border-red-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Open Tickets
              </CardTitle>
              <div className="p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white group-hover:scale-105 transition-transform">
                0
              </div>
              <div className="flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <p className="text-xs text-slate-500">Needs attention</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Clients</CardTitle>
            {/* Search Bar */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 transition-all"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredClients && filteredClients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-4 text-slate-400 font-medium">Business</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Industry</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Owner Email</th>
                      <th className="text-left p-4 text-slate-400 font-medium">Integrations</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr 
                        key={client.id} 
                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-all duration-200 group"
                      >
                        <td className="p-4 text-white font-medium group-hover:text-blue-400 transition-colors">
                          {client.business_name}
                        </td>
                        <td className="p-4 text-slate-300">{client.industry}</td>
                        <td className="p-4">
                          <Badge className={getStatusColor(client.status)}>
                            {client.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-300">{client.owner_email}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <div className={`p-1.5 rounded-lg ${client.integrations?.retell_connected ? 'bg-green-500/10' : 'bg-slate-700/50'}`}>
                              <Phone className={`w-4 h-4 ${client.integrations?.retell_connected ? 'text-green-500' : 'text-slate-600'}`} />
                            </div>
                            <div className={`p-1.5 rounded-lg ${client.integrations?.google_calendar_connected ? 'bg-green-500/10' : 'bg-slate-700/50'}`}>
                              <Calendar className={`w-4 h-4 ${client.integrations?.google_calendar_connected ? 'text-green-500' : 'text-slate-600'}`} />
                            </div>
                            <div className={`p-1.5 rounded-lg ${client.integrations?.stripe_subscription_id ? 'bg-green-500/10' : 'bg-slate-700/50'}`}>
                              <CreditCard className={`w-4 h-4 ${client.integrations?.stripe_subscription_id ? 'text-green-500' : 'text-slate-600'}`} />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Link href={`/techops/clients/${client.id}`}>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-300 transition-all duration-300"
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                {searchQuery ? (
                  <>
                    <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg mb-2">No clients found</p>
                    <p className="text-slate-500 text-sm">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-full bg-slate-800/50 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Users className="w-10 h-10 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-lg mb-2">No clients yet</p>
                    <p className="text-slate-500 text-sm mb-4">
                      Get started by adding your first client
                    </p>
                    <Link href="/techops/clients/new">
                      <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Client
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}