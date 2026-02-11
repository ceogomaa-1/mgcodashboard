import { notFound, redirect } from "next/navigation";
import HealthcareCrmClient from "./healthcare-crm-client";
import { requireHealthcareClient } from "@/lib/healthcare/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function HealthcareCrmPage() {
  const res = await requireHealthcareClient();

  if ("error" in res) {
    if (res.status === 401) redirect("/client/login");
    if (res.status === 403) redirect("/dashboard");
    if (res.status === 404) redirect("/dashboard");
    notFound();
  }

  const { data: patients } = await supabaseAdmin
    .from("healthcare_patients")
    .select(
      "id,full_name,phone,email,service_done,last_visit_date,next_visit_date,notes,created_at,updated_at"
    )
    .eq("business_id", res.client.id)
    .order("last_visit_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return <HealthcareCrmClient client={res.client} initialPatients={patients || []} />;
}
