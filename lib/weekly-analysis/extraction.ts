const DEFAULT_MODEL = process.env.OPENAI_WEEKLY_ANALYTICS_MODEL || "gpt-4.1";

type OpenAIResponseOutput = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

export type WeeklyAnalyticsJson = {
  summary: {
    title: string;
    subtitle: string;
    periodLabel: string;
  };
  kpis: Array<{
    id: string;
    label: string;
    value: number | string;
    unit: string | null;
    previousValue: number | string | null;
    changePercent: number | null;
    trend: "up" | "down" | "flat" | "unknown";
  }>;
  charts: Array<{
    id: string;
    title: string;
    type: "bar" | "line" | "area" | "donut";
    points: Array<{
      label: string;
      value: number;
    }>;
  }>;
  highlights: string[];
  notes: string[];
};

function ensureOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return key;
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "kpis", "charts", "highlights", "notes"],
    properties: {
      summary: {
        type: "object",
        additionalProperties: false,
        required: ["title", "subtitle", "periodLabel"],
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          periodLabel: { type: "string" },
        },
      },
      kpis: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "value", "unit", "previousValue", "changePercent", "trend"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            value: { anyOf: [{ type: "number" }, { type: "string" }] },
            unit: { anyOf: [{ type: "string" }, { type: "null" }] },
            previousValue: { anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }] },
            changePercent: { anyOf: [{ type: "number" }, { type: "null" }] },
            trend: { type: "string", enum: ["up", "down", "flat", "unknown"] },
          },
        },
      },
      charts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "type", "points"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            type: { type: "string", enum: ["bar", "line", "area", "donut"] },
            points: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "value"],
                properties: {
                  label: { type: "string" },
                  value: { type: "number" },
                },
              },
            },
          },
        },
      },
      highlights: { type: "array", items: { type: "string" } },
      notes: { type: "array", items: { type: "string" } },
    },
  };
}

function extractResponseText(data: OpenAIResponseOutput): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const out = data.output || [];
  for (const block of out) {
    const content = block.content || [];
    for (const piece of content) {
      if (piece.type === "output_text" && typeof piece.text === "string") return piece.text;
    }
  }
  throw new Error(data.error?.message || "No output text returned by extraction model.");
}

export async function extractWeeklyAnalyticsFromPdf(file: File): Promise<{
  analysis: WeeklyAnalyticsJson;
  model: string;
}> {
  const apiKey = ensureOpenAIKey();

  const uploadBody = new FormData();
  uploadBody.append("purpose", "user_data");
  uploadBody.append("file", file, file.name || "weekly-analysis.pdf");

  const fileRes = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: uploadBody,
  });

  const fileJson = await fileRes.json().catch(() => ({}));
  if (!fileRes.ok || !fileJson?.id) {
    throw new Error(fileJson?.error?.message || "Failed to upload PDF for extraction.");
  }

  const prompt = [
    "You are extracting analytics from a weekly report PDF.",
    "Return exact values found in the document.",
    "Do not estimate missing values. If a metric is not present, omit it.",
    "Chart points must match source numbers exactly.",
    "Use concise labels.",
  ].join("\n");

  const responseRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extract weekly analytics from this PDF." },
            { type: "input_file", file_id: fileJson.id },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "weekly_analytics",
          schema: buildSchema(),
          strict: true,
        },
      },
    }),
  });

  const responseJson = (await responseRes.json().catch(() => ({}))) as OpenAIResponseOutput;
  if (!responseRes.ok) {
    throw new Error(responseJson?.error?.message || "Extraction model request failed.");
  }

  const text = extractResponseText(responseJson);
  const parsed = JSON.parse(text) as WeeklyAnalyticsJson;
  return { analysis: parsed, model: DEFAULT_MODEL };
}
