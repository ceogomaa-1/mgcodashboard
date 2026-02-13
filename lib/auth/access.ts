import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const techOpsEmails = (process.env.TECHOPS_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

type AuthResult = {
  userId: string;
  email: string;
};

function hasTechOpsClaim(user: {
  app_metadata?: { role?: string };
  user_metadata?: { role?: string };
}) {
  const appRole = String(user?.app_metadata?.role || "").toLowerCase();
  const userRole = String(user?.user_metadata?.role || "").toLowerCase();
  return appRole === "techops" || userRole === "techops";
}

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const email = data.user.email?.trim().toLowerCase();
  if (!email) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  return {
    auth: {
      userId: data.user.id,
      email,
    } satisfies AuthResult,
    user: data.user,
  } as const;
}

export async function requireTechOps() {
  const authRes = await requireAuthenticatedUser();
  if ("error" in authRes) return authRes;

  const { auth, user } = authRes;

  if (hasTechOpsClaim(user)) {
    return { auth } as const;
  }

  if (techOpsEmails.length === 0 || !techOpsEmails.includes(auth.email)) {
    return { error: "Forbidden", status: 403 } as const;
  }

  return { auth } as const;
}

export async function getClientByAuthEmail() {
  const authRes = await requireAuthenticatedUser();
  if ("error" in authRes) return authRes;

  const { auth } = authRes;

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id,business_name,owner_email,industry,status")
    .eq("owner_email", auth.email)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 } as const;
  }

  if (!client) {
    return { error: "Client not found", status: 404 } as const;
  }

  return { auth, client } as const;
}
