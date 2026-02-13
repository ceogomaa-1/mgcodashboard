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

type AccessError = {
  ok: false;
  error: string;
  status: number;
};

type AuthenticatedUserOk = {
  ok: true;
  auth: AuthResult;
  user: {
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
};

type TechOpsOk = {
  ok: true;
  auth: AuthResult;
};

type ClientIdentity = {
  id: string;
  business_name: string | null;
  owner_email: string | null;
  industry: string | null;
  status: string | null;
};

type ClientByEmailOk = {
  ok: true;
  auth: AuthResult;
  client: ClientIdentity;
};

function hasTechOpsClaim(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}) {
  const appRole = String(user?.app_metadata?.["role"] || "").toLowerCase();
  const userRole = String(user?.user_metadata?.["role"] || "").toLowerCase();
  return appRole === "techops" || userRole === "techops";
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUserOk | AccessError> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const email = data.user.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  return {
    ok: true,
    auth: {
      userId: data.user.id,
      email,
    } satisfies AuthResult,
    user: data.user,
  };
}

export async function requireTechOps(): Promise<TechOpsOk | AccessError> {
  const authRes = await requireAuthenticatedUser();
  if (!authRes.ok) return authRes;

  const { auth, user } = authRes;

  if (hasTechOpsClaim(user)) {
    return { ok: true, auth };
  }

  if (techOpsEmails.length === 0 || !techOpsEmails.includes(auth.email)) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  return { ok: true, auth };
}

export async function getClientByAuthEmail(): Promise<ClientByEmailOk | AccessError> {
  const authRes = await requireAuthenticatedUser();
  if (!authRes.ok) return authRes;

  const { auth } = authRes;

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id,business_name,owner_email,industry,status")
    .eq("owner_email", auth.email)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  if (!client) {
    return { ok: false, error: "Client not found", status: 404 };
  }

  return { ok: true, auth, client };
}
