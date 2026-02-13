"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OPENAI_REALTIME_MODELS,
  OPENAI_VOICES,
  type AgentRow,
} from "@/lib/ai-agent/types";

type ClientOption = {
  id: string;
  business_name: string | null;
  owner_email: string | null;
};

type TemplateOption = {
  id: string;
  industry: string;
  template_prompt: string;
  default_model: string;
  default_voice: string;
};

type TwilioNumberOption = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
};

type WizardDraft = {
  name: string;
  industry: string;
  prompt: string;
  twilio_phone_number: string;
  twilio_phone_number_sid: string | null;
  model: string;
  voice: string;
  client_id: string;
};

const INDUSTRY_OPTIONS = [
  "Retail",
  "Restaurant",
  "Auto Shop",
  "Clinic",
  "Real Estate",
  "Other",
];

const STEPS = [
  "Agent name",
  "Category",
  "Prompt",
  "Twilio number",
  "Model",
  "Voice",
  "Calendar",
  "Assign",
  "Publish",
];

function formatClientLabel(client: ClientOption) {
  return client.business_name || client.owner_email || client.id;
}

export default function AIAgentPlaygroundPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [numbers, setNumbers] = useState<TwilioNumberOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [calendarState, setCalendarState] = useState<{
    clientId: string;
    connected: boolean;
    email: string | null;
    checked: boolean;
  }>({ clientId: "", connected: false, email: null, checked: false });

  const [draft, setDraft] = useState<WizardDraft>({
    name: "",
    industry: INDUSTRY_OPTIONS[0],
    prompt: "",
    twilio_phone_number: "",
    twilio_phone_number_sid: null,
    model: OPENAI_REALTIME_MODELS[0],
    voice: OPENAI_VOICES[0],
    client_id: "",
  });

  const templateByIndustry = useMemo(() => {
    const map = new Map<string, TemplateOption>();
    for (const template of templates) map.set(template.industry, template);
    return map;
  }, [templates]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === draft.client_id) || null,
    [clients, draft.client_id]
  );

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [agentsRes, clientsRes, templatesRes, numbersRes] = await Promise.all([
        fetch("/api/techops/agents", { cache: "no-store" }),
        fetch("/api/techops/clients/list", { cache: "no-store" }),
        fetch("/api/techops/agent-templates", { cache: "no-store" }),
        fetch("/api/techops/twilio/numbers", { cache: "no-store" }),
      ]);

      const [agentsJson, clientsJson, templatesJson, numbersJson] = await Promise.all([
        agentsRes.json(),
        clientsRes.json(),
        templatesRes.json(),
        numbersRes.json(),
      ]);

      if (!agentsRes.ok) throw new Error(agentsJson?.error || "Failed to load agents");
      if (!clientsRes.ok) throw new Error(clientsJson?.error || "Failed to load clients");
      if (!templatesRes.ok) throw new Error(templatesJson?.error || "Failed to load templates");
      if (!numbersRes.ok) throw new Error(numbersJson?.error || "Failed to load Twilio numbers");

      setAgents(agentsJson.agents || []);
      setClients(clientsJson.clients || []);
      setTemplates(templatesJson.templates || []);
      setNumbers(numbersJson.numbers || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load AI Agent Playground");
    } finally {
      setLoading(false);
    }
  }

  async function refreshCalendarConnection(clientId: string) {
    if (!clientId) {
      setCalendarState({ clientId: "", connected: false, email: null, checked: false });
      return;
    }

    const res = await fetch(
      `/api/techops/google-calendar-connections?client_id=${encodeURIComponent(clientId)}`,
      { cache: "no-store" }
    );
    const json = await res.json();

    if (!res.ok) {
      setCalendarState({ clientId, connected: false, email: null, checked: true });
      return;
    }

    setCalendarState({
      clientId,
      connected: !!json.connection,
      email: json.connection?.google_email || null,
      checked: true,
    });
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (draft.client_id) {
      refreshCalendarConnection(draft.client_id);
    }
  }, [draft.client_id]);

  useEffect(() => {
    const template = templateByIndustry.get(draft.industry);
    if (!template) return;

    setDraft((prev) => ({
      ...prev,
      prompt: prev.prompt.trim() ? prev.prompt : template.template_prompt,
      model: template.default_model || prev.model,
      voice: template.default_voice || prev.voice,
    }));
  }, [draft.industry, templateByIndustry]);

  async function createAgent() {
    if (!draft.name || !draft.prompt || !draft.twilio_phone_number) {
      setError("Please complete all required wizard fields before publishing.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const createRes = await fetch("/api/techops/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          client_id: draft.client_id || null,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson?.error || "Failed to create agent");

      const created = createJson.agent as AgentRow;

      if (draft.client_id) {
        await fetch(`/api/techops/agents/${created.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: draft.client_id }),
        });
      }

      const publishRes = await fetch(`/api/techops/agents/${created.id}/publish`, {
        method: "POST",
      });
      const publishJson = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishJson?.error || "Failed to publish agent");

      setWizardOpen(false);
      setStep(0);
      setDraft({
        name: "",
        industry: INDUSTRY_OPTIONS[0],
        prompt: "",
        twilio_phone_number: "",
        twilio_phone_number_sid: null,
        model: OPENAI_REALTIME_MODELS[0],
        voice: OPENAI_VOICES[0],
        client_id: "",
      });

      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish agent");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(agentId: string, action: "pause" | "publish") {
    const res = await fetch(`/api/techops/agents/${agentId}/${action}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || `Failed to ${action} agent`);
      return;
    }

    setAgents((current) => current.map((row) => (row.id === agentId ? json.agent : row)));
  }

  async function saveAgentEdits() {
    if (!selectedAgent) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/techops/agents/${selectedAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedAgent.prompt,
          model: selectedAgent.model,
          voice: selectedAgent.voice,
          twilio_phone_number: selectedAgent.twilio_phone_number,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update agent");

      setAgents((rows) => rows.map((row) => (row.id === selectedAgent.id ? json.agent : row)));
      setSelectedAgent(json.agent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSavingEdit(false);
    }
  }

  function selectTwilioNumber(phone: string) {
    const number = numbers.find((entry) => entry.phoneNumber === phone);
    setDraft((prev) => ({
      ...prev,
      twilio_phone_number: number?.phoneNumber || "",
      twilio_phone_number_sid: number?.sid || null,
    }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950/40 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm opacity-70">TechOps</div>
            <h1 className="text-3xl font-semibold tracking-tight">AI Agent Playground</h1>
            <div className="mt-2 text-sm opacity-70">
              Build, assign, and publish AI voice receptionists for clients.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/techops/dashboard">
              <Button variant="secondary">Back</Button>
            </Link>
            <Button onClick={() => setWizardOpen((value) => !value)}>
              {wizardOpen ? "Close Wizard" : "Create Agent"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {wizardOpen ? (
          <Card className="mt-6 border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle>Create Agent Wizard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2 text-xs">
                {STEPS.map((label, idx) => (
                  <div
                    key={label}
                    className={`rounded-lg border px-2 py-1 text-center ${
                      idx === step
                        ? "border-emerald-400/40 bg-emerald-500/20"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    {idx + 1}. {label}
                  </div>
                ))}
              </div>

              {step === 0 ? (
                <div className="space-y-2">
                  <Label>Agent name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Downtown Front Desk"
                  />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={draft.industry}
                    onChange={(e) => setDraft((prev) => ({ ...prev, industry: e.target.value, prompt: "" }))}
                  >
                    {INDUSTRY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <textarea
                    className="min-h-48 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                    value={draft.prompt}
                    onChange={(e) => setDraft((prev) => ({ ...prev, prompt: e.target.value }))}
                  />
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-2">
                  <Label>Twilio number</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={draft.twilio_phone_number}
                    onChange={(e) => selectTwilioNumber(e.target.value)}
                  >
                    <option value="">Select Twilio number</option>
                    {numbers.map((number) => (
                      <option key={number.sid} value={number.phoneNumber}>
                        {number.friendlyName} ({number.phoneNumber})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-2">
                  <Label>LLM model</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={draft.model}
                    onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                  >
                    {OPENAI_REALTIME_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={draft.voice}
                    onChange={(e) => setDraft((prev) => ({ ...prev, voice: e.target.value }))}
                  >
                    {OPENAI_VOICES.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 6 ? (
                <div className="space-y-2">
                  <Label>Calendar automation (Google Calendar)</Label>
                  <div className="text-sm opacity-70">
                    Connect Google Calendar per client, not TechOps personal calendar.
                  </div>

                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={draft.client_id}
                    onChange={(e) => setDraft((prev) => ({ ...prev, client_id: e.target.value }))}
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {formatClientLabel(client)}
                      </option>
                    ))}
                  </select>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                    {calendarState.clientId !== draft.client_id || !calendarState.checked
                      ? "Checking calendar connection..."
                      : calendarState.connected
                      ? `Connected (${calendarState.email || "Google account"})`
                      : "Not connected"}
                  </div>

                  <Button
                    variant="secondary"
                    disabled={!draft.client_id}
                    onClick={() => {
                      window.location.href = `/api/google/oauth/start?client_id=${encodeURIComponent(
                        draft.client_id
                      )}`;
                    }}
                  >
                    Connect Google Calendar
                  </Button>
                </div>
              ) : null}

              {step === 7 ? (
                <div className="space-y-2">
                  <Label>Assign to client</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={draft.client_id}
                    onChange={(e) => setDraft((prev) => ({ ...prev, client_id: e.target.value }))}
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {formatClientLabel(client)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 8 ? (
                <div className="space-y-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
                    <div>
                      <span className="opacity-70">Agent:</span> {draft.name || "-"}
                    </div>
                    <div>
                      <span className="opacity-70">Category:</span> {draft.industry}
                    </div>
                    <div>
                      <span className="opacity-70">Number:</span> {draft.twilio_phone_number || "-"}
                    </div>
                    <div>
                      <span className="opacity-70">Model:</span> {draft.model}
                    </div>
                    <div>
                      <span className="opacity-70">Voice:</span> {draft.voice}
                    </div>
                    <div>
                      <span className="opacity-70">Assigned client:</span>{" "}
                      {selectedClient ? formatClientLabel(selectedClient) : "-"}
                    </div>
                  </div>
                  <Button onClick={createAgent} disabled={creating}>
                    {creating ? "Publishing..." : "Publish"}
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={step >= STEPS.length - 1}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Agents</CardTitle>
            <Button variant="secondary" onClick={loadAll}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm opacity-70">Loading...</div>
            ) : agents.length === 0 ? (
              <div className="text-sm opacity-70">No agents yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left opacity-70 border-b border-white/10">
                      <th className="py-2">Name</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Industry</th>
                      <th className="py-2">Client</th>
                      <th className="py-2">Number</th>
                      <th className="py-2">Last call</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent: AgentRow & { clients?: { business_name?: string | null; owner_email?: string | null }; last_call_at?: string | null }) => (
                      <tr key={agent.id} className="border-b border-white/5">
                        <td className="py-2">{agent.name}</td>
                        <td className="py-2 capitalize">{agent.status}</td>
                        <td className="py-2">{agent.industry}</td>
                        <td className="py-2">
                          {agent.clients?.business_name || agent.clients?.owner_email || "-"}
                        </td>
                        <td className="py-2">{agent.twilio_phone_number}</td>
                        <td className="py-2">
                          {agent.last_call_at
                            ? new Date(agent.last_call_at).toLocaleString()
                            : "No calls yet"}
                        </td>
                        <td className="py-2 flex items-center gap-2">
                          <Button variant="secondary" onClick={() => setSelectedAgent(agent)}>
                            Edit
                          </Button>
                          {agent.status === "published" ? (
                            <Button variant="secondary" onClick={() => changeStatus(agent.id, "pause")}>
                              Pause
                            </Button>
                          ) : (
                            <Button onClick={() => changeStatus(agent.id, "publish")}>Publish</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedAgent ? (
          <Card className="mt-6 border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle>Edit Agent: {selectedAgent.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt</Label>
                <textarea
                  className="min-h-36 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={selectedAgent.prompt}
                  onChange={(e) => setSelectedAgent({ ...selectedAgent, prompt: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={selectedAgent.model}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, model: e.target.value })}
                  >
                    {OPENAI_REALTIME_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Voice</Label>
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={selectedAgent.voice}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, voice: e.target.value })}
                  >
                    {OPENAI_VOICES.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Twilio number</Label>
                  <Input
                    value={selectedAgent.twilio_phone_number}
                    onChange={(e) =>
                      setSelectedAgent({ ...selectedAgent, twilio_phone_number: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={saveAgentEdits} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
                <Button variant="secondary" onClick={() => setSelectedAgent(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
