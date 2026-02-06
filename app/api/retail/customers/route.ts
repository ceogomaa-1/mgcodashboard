import { NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeString(value: any) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(req: Request) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const search = safeString(url.searchParams.get("search"));
  const status = safeString(url.searchParams.get("status"));

  let query = supabaseAdmin
    .from("retail_customers")
    .select("id,full_name,phone,email,notes,status,created_at,updated_at")
    .eq("business_id", guard.client.id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    const term = `%${search}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data: customers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: txRows, error: txErr } = await supabaseAdmin
    .from("retail_transactions")
    .select("customer_id,balance_change_cents,occurred_at")
    .eq("business_id", guard.client.id);

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  const balances: Record<string, number> = {};
  const lastActivity: Record<string, string> = {};

  for (const row of txRows || []) {
    if (!row.customer_id) continue;
    balances[row.customer_id] = (balances[row.customer_id] || 0) + (row.balance_change_cents || 0);
    const occurred = row.occurred_at as string | null;
    if (!occurred) continue;
    if (!lastActivity[row.customer_id]) {
      lastActivity[row.customer_id] = occurred;
    } else if (new Date(occurred).getTime() > new Date(lastActivity[row.customer_id]).getTime()) {
      lastActivity[row.customer_id] = occurred;
    }
  }

  const hydrated = (customers || []).map((c) => ({
    ...c,
    balance_cents: balances[c.id] || 0,
    last_activity: lastActivity[c.id] || null,
  }));

  return NextResponse.json({ customers: hydrated }, { status: 200 });
}

export async function POST(req: Request) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const fullName = safeString(body?.full_name);

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  const payload = {
    business_id: guard.client.id,
    full_name: fullName,
    phone: safeString(body?.phone) || null,
    email: safeString(body?.email) || null,
    notes: safeString(body?.notes) || null,
    status: safeString(body?.status) || "active",
    created_by_user_id: guard.userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("retail_customers")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customer: data }, { status: 201 });
}
