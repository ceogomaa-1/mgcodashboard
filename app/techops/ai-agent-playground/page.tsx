"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OPENAI_REALTIME_MODELS, OPENAI_VOICES, type AgentRow } from "@/lib/ai-agent/types";

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

type AgentListRow = AgentRow & {
  clients?: { business_name?: string | null; owner_email?: string | null };
  last_call_at?: string | null;
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

const INDUSTRY_OPTIONS = ["Retail", "Restaurant", "Auto Shop", "Clinic", "Real Estate", "Other"];
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
  const [agents, setAgents] = useState<AgentListRow[]>([]);
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

      setAgents((agentsJson.agents || []) as AgentListRow[]);
      setClients((clientsJson.clients || []) as ClientOption[]);
      setTemplates((templatesJson.templates || []) as TemplateOption[]);
      setNumbers((numbersJson.numbers || []) as TwilioNumberOption[]);
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
    if (draft.client_id) refreshCalendarConnection(draft.client_id);
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
        body: JSON.stringify({ ...draft, client_id: draft.client_id || null }),
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

      const publishRes = await fetch(`/api/techops/agents/${created.id}/publish`, { method: "POST" });
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
    setAgents((current) => current.map((row) => (row.id === agentId ? (json.agent as AgentListRow) : row)));
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

      setAgents((rows) => rows.map((row) => (row.id === selectedAgent.id ? (json.agent as AgentListRow) : row)));
      setSelectedAgent(json.agent as AgentRow);
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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                TechOps
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">AI Agent Playground</h1>
              <p className="mt-2 text-slate-600">
                Create, assign, and publish AI voice receptionists with per-client calendar automation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/techops/dashboard">
                <Button variant="secondary" className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-50">
                  Back
                </Button>
              </Link>
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => setWizardOpen((value) => !value)}>
                {wizardOpen ? "Close Wizard" : "Create Agent"}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
        </div>

        {wizardOpen ? (
          <Card className="mt-6 border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Create Agent Wizard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {STEPS.map((label, idx) => (
                  <div
                    key={label}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      idx === step
                        ? "border-cyan-300 bg-cyan-100 text-cyan-800"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {idx + 1}. {label}
                  </div>
                ))}
              </div>

              {step === 0 ? (
                <div className="space-y-2">
                  <Label className="text-slate-700">Agent name</Label>
                  <Input
                    className="border-slate-300 bg-white text-slate-900"
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Downtown Front Desk"
                  />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-2">
                  <Label className="text-slate-700">Category</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={draft.industry}
                    onChange={(e) => setDraft((prev) => ({ ...prev, industry: e.target.value, prompt: "" }))}
                  >
                    {INDUSTRY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-2">
                  <Label className="text-slate-700">Prompt</Label>
                  <textarea
                    className="min-h-56 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={draft.prompt}
                    onChange={(e) => setDraft((prev) => ({ ...prev, prompt: e.target.value }))}
                  />
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-2">
                  <Label className="text-slate-700">Twilio number</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
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
                  <Label className="text-slate-700">LLM model</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={draft.model}
                    onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                  >
                    {OPENAI_REALTIME_MODELS.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-2">
                  <Label className="text-slate-700">Voice</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={draft.voice}
                    onChange={(e) => setDraft((prev) => ({ ...prev, voice: e.target.value }))}
                  >
                    {OPENAI_VOICES.map((voice) => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 6 ? (
                <div className="space-y-3">
                  <Label className="text-slate-700">Calendar automation (Google Calendar)</Label>
                  <div className="text-sm text-slate-600">
                    Connect Google Calendar per client (multi-tenant), never TechOps personal calendar.
                  </div>

                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={draft.client_id}
                    onChange={(e) => setDraft((prev) => ({ ...prev, client_id: e.target.value }))}
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{formatClientLabel(client)}</option>
                    ))}
                  </select>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {calendarState.clientId !== draft.client_id || !calendarState.checked
                      ? "Checking calendar connection..."
                      : calendarState.connected
                      ? `Connected (${calendarState.email || "Google account"})`
                      : "Not connected"}
                  </div>

                  <Button
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                    disabled={!draft.client_id}
                    onClick={() => {
                      window.location.href = `/api/google/oauth/start?client_id=${encodeURIComponent(draft.client_id)}`;
                    }}
                  >
                    Connect Google Calendar
                  </Button>
                </div>
              ) : null}

              {step === 7 ? (
                <div className="space-y-2">
                  <Label className="text-slate-700">Assign to client</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={draft.client_id}
                    onChange={(e) => setDraft((prev) => ({ ...prev, client_id: e.target.value }))}
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{formatClientLabel(client)}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {step === 8 ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-slate-800">
                    <div><span className="text-slate-500">Agent:</span> {draft.name || "-"}</div>
                    <div><span className="text-slate-500">Category:</span> {draft.industry}</div>
                    <div><span className="text-slate-500">Number:</span> {draft.twilio_phone_number || "-"}</div>
                    <div><span className="text-slate-500">Model:</span> {draft.model}</div>
                    <div><span className="text-slate-500">Voice:</span> {draft.voice}</div>
                    <div>
                      <span className="text-slate-500">Assigned client:</span> {" "}
                      {selectedClient ? formatClientLabel(selectedClient) : "-"}
                    </div>
                  </div>
                  <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={createAgent} disabled={creating}>
                    {creating ? "Publishing..." : "Publish"}
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  disabled={step >= STEPS.length - 1}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6 border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-slate-900">Agents</CardTitle>
            <Button variant="secondary" className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" onClick={loadAll}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-600">Loading...</div>
            ) : agents.length === 0 ? (
              <div className="text-sm text-slate-600">No agents yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
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
                    {agents.map((agent) => (
                      <tr key={agent.id} className="border-b border-slate-100 text-slate-800">
                        <td className="py-2 font-medium">{agent.name}</td>
                        <td className="py-2 capitalize">{agent.status}</td>
                        <td className="py-2">{agent.industry}</td>
                        <td className="py-2">{agent.clients?.business_name || agent.clients?.owner_email || "-"}</td>
                        <td className="py-2">{agent.twilio_phone_number}</td>
                        <td className="py-2">{agent.last_call_at ? new Date(agent.last_call_at).toLocaleString() : "No calls yet"}</td>
                        <td className="py-2 flex items-center gap-2">
                          <Button variant="secondary" className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" onClick={() => setSelectedAgent(agent)}>
                            Edit
                          </Button>
                          {agent.status === "published" ? (
                            <Button variant="secondary" className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => changeStatus(agent.id, "pause")}>
                              Pause
                            </Button>
                          ) : (
                            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => changeStatus(agent.id, "publish")}>
                              Publish
                            </Button>
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
          <Card className="mt-6 border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Edit Agent: {selectedAgent.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Prompt</Label>
                <textarea
                  className="min-h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  value={selectedAgent.prompt}
                  onChange={(e) => setSelectedAgent({ ...selectedAgent, prompt: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-700">Model</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={selectedAgent.model}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, model: e.target.value })}
                  >
                    {OPENAI_REALTIME_MODELS.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">Voice</Label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={selectedAgent.voice}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, voice: e.target.value })}
                  >
                    {OPENAI_VOICES.map((voice) => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">Twilio number</Label>
                  <Input
                    className="border-slate-300 bg-white text-slate-900"
                    value={selectedAgent.twilio_phone_number}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, twilio_phone_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={saveAgentEdits} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
                <Button variant="secondary" className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" onClick={() => setSelectedAgent(null)}>
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
