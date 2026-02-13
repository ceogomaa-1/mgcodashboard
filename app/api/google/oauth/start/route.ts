import { NextResponse } from "next/server";
import { requireTechOps } from "@/lib/auth/access";
import { buildGoogleOAuthStartUrl } from "@/lib/ai-agent/calendar-tools";

export async function GET(req: Request) {
  const auth = await requireTechOps();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
  }

  const redirect = buildGoogleOAuthStartUrl(clientId);
  return NextResponse.redirect(redirect);
}
