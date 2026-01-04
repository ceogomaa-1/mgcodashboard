'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Chrome, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
const TECHOPS_PASSCODE = 'mgco101';

export default function TechOpsLogin() {
  const [step, setStep] = useState<'passcode' | 'auth'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === TECHOPS_PASSCODE) {
      setStep('auth');
      setError('');
      sessionStorage.setItem('techops_verified', 'true');
    } else {
      setError('Invalid passcode. Access denied.');
      setPasscode('');
    }
  };

  const [email, setEmail] = useState('');

const handleEmailSignIn = async () => {
  setLoading(true);
  setError('');

  if (!email) {
    setError('Please enter your email');
    setLoading(false);
    return;
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?role=TECHOPS`,
      },
    });

    if (error) throw error;
    
    alert('Check your email! We sent you a magic link to sign in.');
  } catch (err: any) {
    setError(err.message || 'Sign in failed');
    setLoading(false);
  }
};

  if (step === 'passcode') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="text-center">
            <Link href="/" className="inline-flex items-center justify-center mb-4 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to portal selection
            </Link>
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              TechOps Access
            </CardTitle>
            <p className="text-slate-400 mt-2">
              Enter the security passcode to continue
            </p>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <label className="text-white text-sm font-medium block mb-2">
                  Security Passcode
                </label>
                <Input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="text-center">
          <button 
            onClick={() => setStep('passcode')}
            className="inline-flex items-center justify-center mb-4 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
          <CardTitle className="text-2xl text-white">
            TechOps Sign In
          </CardTitle>
          <p className="text-slate-400 mt-2">
            Sign in with your Google account
          </p>
        </CardHeader>

        <CardContent>
  {error && (
    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 flex items-center gap-2">
      <AlertCircle className="w-4 h-4" />
      <span className="text-sm">{error}</span>
    </div>
  )}

  <div className="space-y-4">
    <div>
      <label className="text-white text-sm font-medium block mb-2">
        Email Address
      </label>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your-email@mgco.com"
        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
        required
      />
    </div>

    <Button
      onClick={handleEmailSignIn}
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-700"
    >
      {loading ? 'Sending magic link...' : 'Send Magic Link'}
    </Button>
  </div>

  <p className="text-xs text-slate-500 text-center mt-4">
    We'll send you a magic link to sign in
  </p>
</CardContent>
      </Card>
    </div>
  );
}