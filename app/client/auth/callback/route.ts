import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  // If Google/Supabase returned an error
  if (error) {
    return NextResponse.redirect(
      new URL(`/client/login?error=${encodeURIComponent(errorDesc || error)}`, url.origin)
    );
  }

  // If no auth code in callback URL
  if (!code) {
    return NextResponse.redirect(new URL("/client/login?error=Missing+code", url.origin));
  }

  // Exchange code -> session (sets auth cookies)
  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/client/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin)
    );
  }

  // Success → send client to dashboard
  return NextResponse.redirect(new URL("/client/dashboard", url.origin));
}
