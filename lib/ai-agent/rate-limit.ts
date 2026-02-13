const WINDOW_MS = 60000;
const LIMIT_PER_WINDOW = Number(process.env.AGENT_CALL_RATE_LIMIT_PER_MINUTE || 20);

const callsByAgent = new Map<string, number[]>();

export function allowAgentCall(agentId: string) {
  const now = Date.now();
  const threshold = now - WINDOW_MS;
  const existing = callsByAgent.get(agentId) || [];
  const active = existing.filter((value) => value >= threshold);

  if (active.length >= LIMIT_PER_WINDOW) {
    callsByAgent.set(agentId, active);
    return false;
  }

  active.push(now);
  callsByAgent.set(agentId, active);
  return true;
}
