// app/api/techops/clients/[id]/integrations/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonErr(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  if (!clientId) return jsonErr("Missing client id");

  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select(
      "client_id,retell_connected,google_calendar_connected,google_calendar_embed_url,google_calendar_email,google_calendar_id"
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ integration: data ?? null }, { status: 200 });
}

/**
 * POST body:
 * { google_calendar_embed_url: string | null }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  if (!clientId) return jsonErr("Missing client id");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON body");
  }

  let url: string | null = body.google_calendar_embed_url ?? null;

  if (url) {
    url = String(url).trim();

    // allow either embed URL or full iframe snippet (we extract src)
    if (url.includes("<iframe")) {
      const m = url.match(/src="([^"]+)"/i);
      url = m?.[1] ?? null;
    }

    if (!url) return jsonErr("Could not parse embed URL from iframe.");

    // basic validation
    if (!url.startsWith("https://calendar.google.com/calendar/embed")) {
      return jsonErr(
        "Embed URL must start with https://calendar.google.com/calendar/embed"
      );
    }
  }

  // Find existing row
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("integrations")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const payload: any = {
    google_calendar_embed_url: url,
    google_calendar_connected: Boolean(url),
  };

  if (existing?.client_id) {
    const { error: updErr } = await supabaseAdmin
      .from("integrations")
      .update(payload)
      .eq("client_id", clientId);

    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });
  } else {
    const { error: insErr } = await supabaseAdmin
      .from("integrations")
      .insert({ client_id: clientId, ...payload });

    if (insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// Some parts of the app call this endpoint with PATCH.
// Keep PATCH as an alias to POST so the UI doesn't break.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return POST(req, ctx);
}
