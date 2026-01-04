'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2,
  Phone,
  Calendar,
  CreditCard,
  CheckCircle,
  LogOut,
  Mail,
  MapPin,
  Loader2,
  PhoneCall,
  Activity,
  CalendarDays
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
}

export default function ClientDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const fetchClientData = async (userEmail: string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*, integrations(*)')
      .eq('owner_email', userEmail)
      .single();

    if (error || !data) {
      console.error('Error fetching client:', error);
      return null;
    }

    return data;
  };

  const fetchCalendarEvents = async (clientId: string) => {
    try {
      const response = await fetch(`/api/calendar/events?clientId=${clientId}`);
      const data = await response.json();
      
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        router.push('/client/login');
        return;
      }
      setUser(user);

      const clientData = await fetchClientData(user.email);
      if (!clientData) {
        router.push('/client/login');
        return;
      }

      setClient(clientData);

      if (clientData.integrations?.google_calendar_connected) {
        await fetchCalendarEvents(clientData.id);
      }

      setLoading(false);
      
      // Check if just connected
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'calendar_connected') {
        console.log('✅ Calendar connected! Cleaning URL...');
        window.history.replaceState({}, '', '/client/dashboard');
      }
    };

    fetchData();
  }, []);

  const refreshClientData = async () => {
    if (!user?.email || refreshing) return;
    
    setRefreshing(true);
    console.log('Refreshing client data...');
    
    const clientData = await fetchClientData(user.email);
    if (clientData) {
      setClient(clientData);
      if (clientData.integrations?.google_calendar_connected) {
        await fetchCalendarEvents(clientData.id);
      }
    }
    
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user?.email) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible - refreshing...');
        refreshClientData();
      }
    };

    const checkForUpdates = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'calendar_connected') {
        console.log('Success param detected - refreshing...');
        refreshClientData();
        window.history.replaceState({}, '', '/client/dashboard');
      }
    };

    // Check on mount
    checkForUpdates();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Poll every 2 seconds for the first 10 seconds after mount
    const intervals = [1000, 2000, 3000, 5000, 8000].map((delay) => 
      setTimeout(checkForUpdates, delay)
    );

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      intervals.forEach(clearTimeout);
    };
  }, [user?.email]);

  const connectGoogleCalendar = () => {
    if (!client?.id) return;
    window.location.href = `/api/auth/google?clientId=${client.id}`;
  };

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getEventsForDateTime = (date: Date, hour: number) => {
    return events.filter(event => {
      if (!event.start.dateTime) return false;
      const eventDate = new Date(event.start.dateTime);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getHours() === hour
      );
    });
  };

  const formatTime = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const getStatusColor = (status: string) => {
    const colors = {
      ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      ONBOARDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      PAUSED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      CANCELED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return colors[status as keyof typeof colors] || colors.PAUSED;
  };

  const weekDays = getWeekDays(currentWeek);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {client.business_name}
            </h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <Button 
              variant="outline" 
              className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-1">Good to see you 👋</h2>
          <p className="text-gray-500">Here's what's happening with your services</p>
        </div>

        <Card className="border-white/5 bg-white/[0.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-2">Account Status</p>
                <Badge className={getStatusColor(client.status)}>
                  {client.status}
                </Badge>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-white/5 bg-white/[0.02] lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-white text-lg font-medium flex items-center gap-2">
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
                    {client.city && client.state && (
                      <p className="text-gray-500 text-sm">
                        {client.city}, {client.state} {client.zip_code}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-white/[0.02] lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg font-medium flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-400" />
                  Your Calendar
                </CardTitle>
                {client.integrations?.google_calendar_connected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    You're Connected
                  </Badge>
                ) : (
                  <Button
                    onClick={connectGoogleCalendar}
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Calendar className="w-3 h-3 mr-2" />
                    Connect Calendar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {client.integrations?.google_calendar_connected ? (
                <div className="bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="p-2 text-center text-[10px] text-gray-500 font-medium border-r border-white/5">Time</div>
                    {weekDays.map((day, i) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      return (
                        <div key={i} className="p-2 text-center border-r border-white/5 last:border-r-0">
                          <div className="text-[10px] text-gray-500 font-medium">{dayNames[i]}</div>
                          <div className={`text-sm font-semibold ${isToday ? 'text-emerald-400' : 'text-white'}`}>
                            {day.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {hours.map(hour => (
                      <div key={hour} className="grid grid-cols-8 border-b border-white/5 min-h-[40px]">
                        <div className="p-1 text-center text-[9px] text-gray-500 border-r border-white/5 flex items-center justify-center">
                          {formatTime(hour)}
                        </div>
                        
                        {weekDays.map((day, dayIndex) => {
                          const dayEvents = getEventsForDateTime(day, hour);
                          return (
                            <div key={dayIndex} className="p-1 border-r border-white/5 last:border-r-0 relative">
                              {dayEvents.map(event => (
                                <div
                                  key={event.id}
                                  className="bg-emerald-500/20 border-l-2 border-emerald-400 rounded px-1 py-0.5 text-[9px] cursor-pointer hover:bg-emerald-500/30 transition-colors"
                                >
                                  <div className="text-white font-medium truncate">{event.summary}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 text-center border-t border-white/5">
                    <Link href="/client/calendar">
                      <Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10">
                        View Full Calendar
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">Connect your Google Calendar</p>
                  <p className="text-gray-600 text-sm mb-4">
                    View and manage all your appointments in one place
                  </p>
                  <Button
                    onClick={connectGoogleCalendar}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Connect Google Calendar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-lg font-medium">Active Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <PhoneCall className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">AI Phone System</p>
                    <p className="text-xs text-gray-500">Automated calls</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 w-full justify-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>

              <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Calendar</p>
                    <p className="text-xs text-gray-500">Scheduling</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 w-full justify-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>

              <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Billing</p>
                    <p className="text-xs text-gray-500">Payments</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 w-full justify-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">Need assistance?</h3>
              <p className="text-gray-400 mb-4 text-sm">Our team is here to help you succeed</p>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}