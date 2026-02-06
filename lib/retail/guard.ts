import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RetailClient = {
  id: string;
  business_name: string | null;
  owner_email: string | null;
  industry: string | null;
  state: string | null;
};

function normalizeIndustry(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export async function requireRetailClient() {
  const supabase = await createClient();

  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr) return { error: uErr.message, status: 401 };

  const email = u?.user?.email?.trim();
  if (!email) return { error: "Not authenticated", status: 401 };

  const { data: client, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("id,business_name,owner_email,industry,state")
    .eq("owner_email", email)
    .maybeSingle();

  if (cErr) return { error: cErr.message, status: 500 };
  if (!client) return { error: "Client not found", status: 404 };
  if (normalizeIndustry(client.industry) !== "retail") {
    return { error: "Forbidden", status: 403 };
  }

  return { client: client as RetailClient, userId: u?.user?.id || null };
}
