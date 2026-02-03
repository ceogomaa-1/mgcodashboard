import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRealEstateClient } from "@/lib/listings/realEstate";
import { randomUUID } from "crypto";

const BUCKET = "listing-uploads";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function uploadToStorage(path: string, file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) throw new Error(error.message);
}

export async function POST(req: Request) {
  const guard = await requireRealEstateClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const formData = await req.formData();
  const mlsFile = formData.get("mlsFile");
  const photos = formData.getAll("photos");

  if (!(mlsFile instanceof File)) {
    return NextResponse.json({ error: "MLS file is required." }, { status: 400 });
  }

  const mlsName = mlsFile.name.toLowerCase();
  const isPdf = mlsName.endsWith(".pdf") || mlsFile.type === "application/pdf";
  const isCsv =
    mlsName.endsWith(".csv") ||
    mlsFile.type === "text/csv" ||
    mlsFile.type === "application/vnd.ms-excel";

  if (!isPdf && !isCsv) {
    return NextResponse.json({ error: "MLS file must be PDF or CSV." }, { status: 400 });
  }

  const listingId = randomUUID();

  const { data: listing, error: lErr } = await supabaseAdmin
    .from("listings")
    .insert({ id: listingId, client_id: guard.client.id, status: "uploaded" })
    .select("id,client_id,status,created_at")
    .single();

  if (lErr || !listing) {
    return NextResponse.json({ error: lErr?.message || "Failed to create listing." }, { status: 500 });
  }

  const basePath = `${guard.client.id}/${listingId}`;
  const uploadedPaths: { path: string; type: "mls" | "photo" }[] = [];

  try {
    const mlsPath = `${basePath}/mls-${Date.now()}-${safeFileName(mlsFile.name)}`;
    await uploadToStorage(mlsPath, mlsFile);
    uploadedPaths.push({ path: mlsPath, type: "mls" });

    for (const p of photos) {
      if (!(p instanceof File)) continue;
      if (!p.type.startsWith("image/")) continue;
      const photoPath = `${basePath}/photo-${randomUUID()}-${safeFileName(p.name)}`;
      await uploadToStorage(photoPath, p);
      uploadedPaths.push({ path: photoPath, type: "photo" });
    }
  } catch (err: any) {
    await supabaseAdmin.from("listings").update({ status: "error" }).eq("id", listingId);
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }

  if (uploadedPaths.length) {
    const { error: aErr } = await supabaseAdmin.from("listing_assets").insert(
      uploadedPaths.map((u) => ({
        listing_id: listingId,
        file_path: u.path,
        file_type: u.type,
      }))
    );

    if (aErr) {
      await supabaseAdmin.from("listings").update({ status: "error" }).eq("id", listingId);
      return NextResponse.json({ error: aErr.message }, { status: 500 });
    }
  }

  await supabaseAdmin.from("listing_logs").insert({
    listing_id: listingId,
    message: "Listing created",
  });

  const fileUrls = uploadedPaths.map((u) => {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(u.path);
    return { path: u.path, type: u.type, url: data.publicUrl };
  });

  // TODO(n8n): POST /webhook/listing-created with listing_id, client_id, file URLs.
  const n8nPayload = {
    listing_id: listingId,
    client_id: guard.client.id,
    files: fileUrls,
  };

  return NextResponse.json({ listing, files: fileUrls, n8nPayload }, { status: 200 });
}
