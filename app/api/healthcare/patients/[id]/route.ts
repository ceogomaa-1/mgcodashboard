import { NextRequest, NextResponse } from "next/server";
import { requireHealthcareClient } from "@/lib/healthcare/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function cleanString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireHealthcareClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("healthcare_patients")
    .select(
      "id,full_name,phone,email,service_done,last_visit_date,next_visit_date,notes,created_at,updated_at"
    )
    .eq("business_id", guard.client.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ patient: data }, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireHealthcareClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  const fullName = cleanString(body?.full_name);
  if (fullName) patch.full_name = fullName;

  if (typeof body?.phone === "string") patch.phone = cleanString(body.phone) || null;
  if (typeof body?.email === "string") patch.email = cleanString(body.email) || null;

  const serviceDone = cleanString(body?.service_done);
  if (serviceDone) patch.service_done = serviceDone;

  const lastVisitDate = cleanString(body?.last_visit_date);
  if (lastVisitDate) patch.last_visit_date = lastVisitDate;

  if (typeof body?.next_visit_date === "string") {
    patch.next_visit_date = cleanString(body.next_visit_date) || null;
  }

  if (typeof body?.notes === "string") patch.notes = cleanString(body.notes) || null;

  const { data, error } = await supabaseAdmin
    .from("healthcare_patients")
    .update(patch)
    .eq("business_id", guard.client.id)
    .eq("id", id)
    .select(
      "id,full_name,phone,email,service_done,last_visit_date,next_visit_date,notes,created_at,updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ patient: data }, { status: 200 });
}
