import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRealEstateClient } from "@/lib/listings/realEstate";
import { randomUUID } from "crypto";

const BUCKET = "listing-uploads";
const AUTOMATION_WEBHOOK_URL =
  process.env.LISTING_AUTOMATION_WEBHOOK_URL ||
  "https://hooks.zapier.com/hooks/catch/15467201/u03h9xb/";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
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

function extractCaption(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as {
    caption?: unknown;
    listing_caption?: unknown;
    social_caption?: unknown;
    result?: { caption?: unknown };
    data?: { caption?: unknown };
  };
  const candidates = [
    parsed.caption,
    parsed.listing_caption,
    parsed.social_caption,
    parsed.result?.caption,
    parsed.data?.caption,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
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
  } catch (err: unknown) {
    await supabaseAdmin.from("listings").update({ status: "error" }).eq("id", listingId);
    return NextResponse.json({ error: getErrorMessage(err) || "Upload failed." }, { status: 500 });
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
    message: "Listing created and files uploaded",
  });

  const fileUrls = uploadedPaths.map((u) => {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(u.path);
    return { path: u.path, type: u.type, url: data.publicUrl };
  });

  const automationPayload = {
    listing_id: listingId,
    client_id: guard.client.id,
    files: fileUrls,
  };

  let automationResponse: unknown = null;
  let caption: string | null = null;

  try {
    const webhookRes = await fetch(AUTOMATION_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(automationPayload),
      cache: "no-store",
    });

    const contentType = webhookRes.headers.get("content-type") || "";
    const textBody = await webhookRes.text();
    if (!textBody.trim()) {
      automationResponse = null;
    } else if (contentType.includes("application/json")) {
      try {
        automationResponse = JSON.parse(textBody);
      } catch {
        automationResponse = { raw: textBody };
      }
    } else {
      automationResponse = { raw: textBody };
    }

    if (!webhookRes.ok) {
      await supabaseAdmin
        .from("listings")
        .update({
          status: "error",
          n8n_response: automationResponse,
        })
        .eq("id", listingId);
      await supabaseAdmin.from("listing_logs").insert({
        listing_id: listingId,
        message: `automation webhook failed with status ${webhookRes.status}`,
      });
      return NextResponse.json(
        { error: `automation webhook failed (${webhookRes.status})`, listing_id: listingId },
        { status: 502 }
      );
    }

    caption = extractCaption(automationResponse);
    await supabaseAdmin
      .from("listings")
      .update({
        status: caption ? "draft_ready" : "processing",
        caption,
        n8n_response: automationResponse,
      })
      .eq("id", listingId);

    await supabaseAdmin.from("listing_logs").insert({
      listing_id: listingId,
      message: "automation webhook triggered successfully",
    });
  } catch (err: unknown) {
    const details = getErrorMessage(err);
    await supabaseAdmin
      .from("listings")
      .update({
        status: "error",
      })
      .eq("id", listingId);
    await supabaseAdmin.from("listing_logs").insert({
      listing_id: listingId,
      message: `automation webhook error: ${details}`,
    });
    return NextResponse.json(
      {
        error: "Files uploaded but automation webhook failed.",
        details,
        listing_id: listingId,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      listing: {
        ...listing,
        status: caption ? "draft_ready" : "processing",
        caption,
      },
      files: fileUrls,
      automationPayload,
      automationResponse,
    },
    { status: 200 }
  );
}
