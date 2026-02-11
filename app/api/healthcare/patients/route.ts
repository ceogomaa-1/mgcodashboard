import { NextRequest, NextResponse } from "next/server";
import { requireHealthcareClient } from "@/lib/healthcare/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function cleanString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(req: NextRequest) {
  const guard = await requireHealthcareClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const search = cleanString(url.searchParams.get("search"));

  let query = supabaseAdmin
    .from("healthcare_patients")
    .select(
      "id,full_name,phone,email,service_done,last_visit_date,next_visit_date,notes,created_at,updated_at"
    )
    .eq("business_id", guard.client.id)
    .order("last_visit_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (search) {
    const term = `%${search}%`;
    query = query.or(`full_name.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ patients: data || [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const guard = await requireHealthcareClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));

  const fullName = cleanString(body?.full_name);
  const phone = cleanString(body?.phone);
  const serviceDone = cleanString(body?.service_done);
  const lastVisitDate = cleanString(body?.last_visit_date);

  if (!fullName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (!phone) {
    return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
  }

  if (!serviceDone) {
    return NextResponse.json({ error: "Service done is required." }, { status: 400 });
  }

  if (!lastVisitDate) {
    return NextResponse.json({ error: "Last visit date is required." }, { status: 400 });
  }

  const payload = {
    business_id: guard.client.id,
    full_name: fullName,
    phone,
    email: cleanString(body?.email) || null,
    service_done: serviceDone,
    last_visit_date: lastVisitDate,
    next_visit_date: cleanString(body?.next_visit_date) || null,
    notes: cleanString(body?.notes) || null,
    created_by_user_id: guard.userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("healthcare_patients")
    .insert(payload)
    .select(
      "id,full_name,phone,email,service_done,last_visit_date,next_visit_date,notes,created_at,updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ patient: data }, { status: 201 });
}
