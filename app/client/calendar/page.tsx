'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  CheckCircle,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
}

// Supabase can return related rows as an array; normalize to a single object.
function normalizeIntegrations(clientRow: any) {
  const raw = clientRow?.integrations;
  const normalized = Array.isArray(raw) ? raw[0] : raw;
  return { ...clientRow, integrations: normalized || null };
}

export default function ClientCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const supabase = createClient();
  const router = useRouter();

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

    return normalizeIntegrations(data);
  };

  const fetchCalendarEvents = async (clientId: string) => {
    try {
      const response = await fetch(`/api/calendar/events?clientId=${clientId}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        console.error('Calendar events error:', data);
        return;
      }

      if (data.events) setEvents(data.events);
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
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

      // Handle success redirect after connect
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'calendar_connected') {
        await fetchCalendarEvents(clientData.id);
        window.history.replaceState({}, '', '/client/calendar');
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogleCalendar = () => {
    if (!client?.id) return;
    window.location.href = `/api/auth/google?clientId=${client.id}`;
  };

  const refreshNow = async () => {
    if (!client?.id || !client?.integrations?.google_calendar_connected) return;
    if (refreshing) return;
    setRefreshing(true);
    await fetchCalendarEvents(client.id);
    setRefreshing(false);
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

  if (!client) return null;

  const weekDays = getWeekDays(currentWeek);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Calendar</h1>
            <p className="text-gray-500 text-sm">{client?.business_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/client/dashboard">
              <Button variant="outline" className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10">
                Back
              </Button>
            </Link>

            <Button
              onClick={refreshNow}
              variant="outline"
              className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
              disabled={!client.integrations?.google_calendar_connected || refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>

            <form action="/auth/signout" method="post">
              <Button variant="outline" className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg font-medium flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Google Calendar
              </CardTitle>

              {client.integrations?.google_calendar_connected ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Button onClick={connectGoogleCalendar} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Connect Calendar
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {!client.integrations?.google_calendar_connected ? (
              <div className="text-center py-10">
                <p className="text-gray-400 mb-2">Connect your Google Calendar to view your bookings here.</p>
                <Button onClick={connectGoogleCalendar} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Connect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
                    onClick={() => {
                      const prev = new Date(currentWeek);
                      prev.setDate(prev.getDate() - 7);
                      setCurrentWeek(prev);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                  </Button>

                  <div className="text-gray-300 text-sm">
                    Week of {weekDays[0].toLocaleDateString()}
                  </div>

                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
                    onClick={() => {
                      const next = new Date(currentWeek);
                      next.setDate(next.getDate() + 7);
                      setCurrentWeek(next);
                    }}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="p-2 text-center text-[10px] text-gray-500 font-medium border-r border-white/5">
                      Time
                    </div>
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

                  <div className="max-h-[520px] overflow-y-auto">
                    {hours.map(hour => (
                      <div key={hour} className="grid grid-cols-8 border-b border-white/5 min-h-[44px]">
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
                                  className="bg-emerald-500/20 border-l-2 border-emerald-400 rounded px-2 py-1 text-[10px] cursor-pointer hover:bg-emerald-500/30 transition-colors"
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
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
