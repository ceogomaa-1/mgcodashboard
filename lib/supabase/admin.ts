// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

// Service-role admin client (bypasses RLS). NEVER expose this to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Convenience export many files expect
export const supabaseAdmin = createAdminClient();
