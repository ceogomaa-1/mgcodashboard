import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRealEstateClient } from "@/lib/listings/realEstate";

export async function GET() {
  const guard = await requireRealEstateClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data: listings, error } = await supabaseAdmin
    .from("listings")
    .select("id,status,created_at,address,caption")
    .eq("client_id", guard.client.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ listings: listings || [] }, { status: 200 });
}
