import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  // Get the current user to determine which portal they came from
  const { data: { user } } = await supabase.auth.getUser();

  // Sign out
  await supabase.auth.signOut();

  // Determine redirect based on email domain or check which portal
  // For now, we'll check if the email exists in clients table
  let redirectUrl = '/techops/login'; // Default to TechOps

  if (user?.email) {
    const { data: client } = await supabase
      .from('clients')
      .select('owner_email')
      .eq('owner_email', user.email)
      .single();

    if (client) {
      // This is a client user
      redirectUrl = '/client/login';
    }
  }

  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
