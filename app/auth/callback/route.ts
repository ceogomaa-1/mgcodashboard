import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const role = searchParams.get('role');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user exists in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!existingUser) {
        // Create new user with specified role
        await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          role: role || 'CLIENT',
          full_name: data.user.user_metadata.full_name,
        });
      }

      // Redirect based on role
      if (role === 'TECHOPS') {
        return NextResponse.redirect(`${origin}/techops/dashboard`);
      } else {
        return NextResponse.redirect(`${origin}/client/dashboard`);
      }
    }
  }

  // If there was an error or no code, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}