import { NextResponse } from "next/server";
import { getClientByAuthEmail } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "client-reports";

export async function GET() {
  const auth = await getClientByAuthEmail();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("client_reports")
    .select("id,file_path,file_name,mime_type,size_bytes,created_at")
    .eq("client_id", auth.client.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reports = await Promise.all(
    (data || []).map(async (report) => {
      const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(report.file_path, 60 * 60);
      return {
        id: report.id,
        file_name: report.file_name,
        mime_type: report.mime_type,
        size_bytes: report.size_bytes,
        created_at: report.created_at,
        download_url: signed.data?.signedUrl || null,
      };
    })
  );

  return NextResponse.json({ reports }, { status: 200 });
}
