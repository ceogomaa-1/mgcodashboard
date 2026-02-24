import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRealEstateClient } from "@/lib/listings/realEstate";

const BUCKET = "listing-uploads";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRealEstateClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing listing id." }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id,client_id,status,created_at,address,caption,n8n_response")
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    return NextResponse.json({ error: listingError.message }, { status: 500 });
  }

  if (!listing || listing.client_id !== guard.client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: assets, error: assetError } = await supabaseAdmin
    .from("listing_assets")
    .select("id,file_path,file_type,created_at")
    .eq("listing_id", id)
    .order("created_at", { ascending: true });

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 500 });
  }

  const files = (assets || []).map((asset) => {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(asset.file_path);
    return {
      id: asset.id,
      file_path: asset.file_path,
      file_type: asset.file_type,
      url: data.publicUrl,
    };
  });

  return NextResponse.json(
    {
      listing: {
        id: listing.id,
        status: listing.status,
        created_at: listing.created_at,
        address: listing.address,
        caption: listing.caption,
      },
      files,
    },
    { status: 200 }
  );
}
