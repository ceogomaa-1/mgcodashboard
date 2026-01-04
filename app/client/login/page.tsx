'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react';

export default function ClientLogin() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Check if email exists in clients table
      const { data: client } = await supabase
        .from('clients')
        .select('owner_email')
        .eq('owner_email', email)
        .single();

      if (!client) {
        setError('No client account found with this email. Please contact MG&CO support.');
        setLoading(false);
        return;
      }

      // Send magic link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/client/dashboard`,
        },
      });

      if (authError) throw authError;

      setSuccess(true);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md relative">
        {/* Back to Home */}
        <Link 
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <Card className="border-slate-700/50 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-blue-500/10 w-fit">
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl text-white">Client Portal</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to access your MG&CO dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 p-3 rounded-full bg-green-500/10 w-fit">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Check your email!</h3>
                <p className="text-slate-400 mb-2">
                  We've sent a magic link to
                </p>
                <p className="text-blue-400 font-medium mb-4">{email}</p>
                <p className="text-slate-500 text-sm">
                  Click the link in your email to sign in to your dashboard
                </p>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-red-500 font-medium">Error</p>
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 transition-all"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter the email address associated with your MG&CO account
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending magic link...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Magic Link
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-900/50 text-slate-500">
                      Secure passwordless login
                    </span>
                  </div>
                </div>

                <p className="text-center text-slate-500 text-sm">
                  Don't have an account?{' '}
                  <span className="text-slate-400">Contact MG&CO to get started</span>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Security Badge */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-xs flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secured by MG&CO • All data encrypted
          </p>
        </div>
      </div>
    </div>
  );
}