import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireTechOps } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractWeeklyAnalyticsFromPdf } from "@/lib/weekly-analysis/extraction";

const BUCKET = "weekly-analysis-pdfs";
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function isPdf(file: File) {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || file.type === "application/pdf";
}

function parseDate(input: unknown) {
  if (typeof input !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return input;
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
    .from("client_weekly_analyses")
    .select("id,client_id,week_start,week_end,report_file_name,status,analysis_json,created_at")
    .eq("client_id", clientId)
    .order("week_end", { ascending: false })
    .limit(12);

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
  const file = formData.get("file");
  const weekStart = parseDate(formData.get("weekStart"));
  const weekEnd = parseDate(formData.get("weekEnd"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
  }
  if (!isPdf(file)) {
    return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "PDF is too large (max 20MB)." }, { status: 400 });
  }
  if (!weekStart || !weekEnd) {
    return NextResponse.json({ error: "weekStart and weekEnd are required (YYYY-MM-DD)." }, { status: 400 });
  }
  if (weekStart > weekEnd) {
    return NextResponse.json({ error: "weekStart cannot be after weekEnd." }, { status: 400 });
  }

  const reportId = randomUUID();
  const filePath = `${clientId}/${weekStart}_${weekEnd}/${reportId}-${safeFileName(file.name)}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  try {
    const { analysis, model } = await extractWeeklyAnalyticsFromPdf(file);

    const payload = {
      id: reportId,
      client_id: clientId,
      week_start: weekStart,
      week_end: weekEnd,
      report_file_path: filePath,
      report_file_name: file.name,
      status: "ready",
      analysis_json: analysis,
      extraction_model: model,
      created_by_user_id: auth.auth.userId,
    };

    const { data, error } = await supabaseAdmin
      .from("client_weekly_analyses")
      .upsert(payload, { onConflict: "client_id,week_start,week_end" })
      .select("id,client_id,week_start,week_end,report_file_name,status,analysis_json,created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, report: data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to extract analytics from PDF.";
    const failedPayload = {
      id: reportId,
      client_id: clientId,
      week_start: weekStart,
      week_end: weekEnd,
      report_file_path: filePath,
      report_file_name: file.name,
      status: "failed",
      analysis_json: {},
      extraction_notes: message,
      created_by_user_id: auth.auth.userId,
    };
    await supabaseAdmin
      .from("client_weekly_analyses")
      .upsert(failedPayload, { onConflict: "client_id,week_start,week_end" });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
