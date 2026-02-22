import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireTechOps } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "client-reports";
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function allowedFile(file: File) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return true;
  return file.type.startsWith("image/");
}

async function ensureBucket() {
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) throw new Error(listErr.message);

  const exists = (buckets || []).some((bucket) => bucket.name === BUCKET);
  if (exists) return;

  const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"],
  });

  if (
    createErr &&
    !/already exists/i.test(createErr.message) &&
    !/duplicate/i.test(createErr.message)
  ) {
    throw new Error(createErr.message);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTechOps();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: clientId } = await params;
  if (!clientId) return NextResponse.json({ error: "Missing client id." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("client_reports")
    .select("id,client_id,file_name,mime_type,size_bytes,created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data || [] }, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTechOps();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: clientId } = await params;
  if (!clientId) return NextResponse.json({ error: "Missing client id." }, { status: 400 });

  const formData = await req.formData();
  const files = formData.getAll("files");
  const validFiles = files.filter((file): file is File => file instanceof File);

  if (!validFiles.length) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  try {
    await ensureBucket();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initialize storage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const inserts: Array<{
    client_id: string;
    file_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number;
    uploaded_by_user_id: string;
  }> = [];

  for (const file of validFiles) {
    if (!allowedFile(file)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.name}. Allowed: PDF or images.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large: ${file.name}. Max is 25MB.` },
        { status: 400 }
      );
    }

    const path = `${clientId}/${Date.now()}-${randomUUID()}-${safeFileName(file.name)}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    inserts.push({
      client_id: clientId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by_user_id: auth.auth.userId,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("client_reports")
    .insert(inserts)
    .select("id,client_id,file_name,mime_type,size_bytes,created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reports: data || [] }, { status: 200 });
}
