import { NextResponse } from "next/server";
import { requireTechOps } from "@/lib/auth/access";
import { listTwilioNumbers } from "@/lib/twilio/api";

export async function GET() {
  const auth = await requireTechOps();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const numbers = await listTwilioNumbers();
    return NextResponse.json({ numbers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list Twilio numbers";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
