export type AgentStatus = "draft" | "published" | "paused";

export type CallOutcome =
  | "booked"
  | "cancelled"
  | "rescheduled"
  | "info_only"
  | "hangup"
  | "transfer"
  | "error"
  | "other";

export type CallEventType =
  | "audio_started"
  | "user_said"
  | "agent_said"
  | "tool_called"
  | "tool_result"
  | "booking_created"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "call_ended"
  | "error";

export type AgentRow = {
  id: string;
  name: string;
  industry: string;
  prompt: string;
  model: string;
  voice: string;
  twilio_phone_number: string;
  twilio_phone_number_sid: string | null;
  status: AgentStatus;
  client_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export const OPENAI_REALTIME_MODELS = [
  "gpt-4o-realtime-preview-2025-06-03",
  "gpt-4o-mini-realtime-preview-2025-06-03",
] as const;

export const OPENAI_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "sage",
  "shimmer",
  "verse",
] as const;
