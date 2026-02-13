import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTechOps } from "@/lib/auth/access";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const auth = await requireTechOps();
  if ("error" in auth) return bad(auth.error, auth.status);

  const { data, error } = await supabaseAdmin
    .from("agent_templates")
    .select("id,industry,template_prompt,default_model,default_voice,created_at")
    .order("industry", { ascending: true });

  if (error) return bad(error.message, 500);
  return NextResponse.json({ templates: data || [] });
}

export async function POST(req: Request) {
  const auth = await requireTechOps();
  if ("error" in auth) return bad(auth.error, auth.status);

  const body = await req.json().catch(() => null);
  if (!body) return bad("Invalid JSON body");

  const industry = String(body.industry || "").trim();
  const templatePrompt = String(body.template_prompt || "").trim();
  const defaultModel = String(body.default_model || "").trim();
  const defaultVoice = String(body.default_voice || "").trim();

  if (!industry || !templatePrompt || !defaultModel || !defaultVoice) {
    return bad("industry, template_prompt, default_model and default_voice are required");
  }

  const { data, error } = await supabaseAdmin
    .from("agent_templates")
    .upsert(
      {
        industry,
        template_prompt: templatePrompt,
        default_model: defaultModel,
        default_voice: defaultVoice,
      },
      { onConflict: "industry" }
    )
    .select("id,industry,template_prompt,default_model,default_voice,created_at")
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ template: data }, { status: 201 });
}
