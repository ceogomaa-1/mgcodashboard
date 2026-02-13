import { NextResponse } from "next/server";
import { parseGoogleOAuthState, saveGoogleOAuthTokens } from "@/lib/ai-agent/calendar-tools";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const clientId = parseGoogleOAuthState(state);

  if (!code || !clientId) {
    return NextResponse.redirect(
      `${origin}/techops/ai-agent-playground?oauth_error=missing_code_or_state`
    );
  }

  try {
    await saveGoogleOAuthTokens({ clientId, code });
    return NextResponse.redirect(
      `${origin}/techops/ai-agent-playground?oauth_client_id=${clientId}&oauth_status=connected`
    );
  } catch (error: unknown) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "oauth_failed"
    );
    return NextResponse.redirect(
      `${origin}/techops/ai-agent-playground?oauth_client_id=${clientId}&oauth_error=${message}`
    );
  }
}
