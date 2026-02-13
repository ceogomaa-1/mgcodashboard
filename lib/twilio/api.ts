import { Buffer } from "node:buffer";

export type TwilioIncomingPhoneNumber = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
};

function getTwilioApiBase() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  if (!accountSid) {
    throw new Error("Missing TWILIO_ACCOUNT_SID");
  }

  return {
    accountSid,
    url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`,
  };
}

function getAuthHeader() {
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

  if (!apiKeySid || !apiKeySecret) {
    throw new Error("Missing TWILIO_API_KEY_SID or TWILIO_API_KEY_SECRET");
  }

  const basic = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");
  return `Basic ${basic}`;
}

export async function listTwilioNumbers(): Promise<TwilioIncomingPhoneNumber[]> {
  const base = getTwilioApiBase();
  const response = await fetch(`${base.url}/IncomingPhoneNumbers.json?PageSize=200`, {
    headers: {
      Authorization: getAuthHeader(),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let json: { incoming_phone_numbers?: Array<{ sid?: string; phone_number?: string; friendly_name?: string }>; message?: string } | null =
    null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(json?.message || `Twilio error (${response.status})`);
  }

  return (json?.incoming_phone_numbers || []).map((row) => ({
    sid: String(row.sid || ""),
    phoneNumber: String(row.phone_number || ""),
    friendlyName: String(row.friendly_name || row.phone_number || ""),
  }));
}

export function toTwiml(parts: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${parts.join("")}</Response>`;
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
