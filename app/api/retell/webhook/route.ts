import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Retell webhook endpoint is live. Use POST for webhook delivery." },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    const body: Record<string, unknown> = await req.json().catch(() => ({}));

    // We acknowledge quickly so Retell webhook tests pass (2xx required).
    return NextResponse.json(
      {
        ok: true,
        received: true,
        event:
          (typeof body.event === "string" && body.event) ||
          (typeof body.type === "string" && body.type) ||
          "unknown",
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Webhook handler error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
