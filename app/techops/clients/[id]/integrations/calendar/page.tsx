"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Integration = {
  google_calendar_connected: boolean;
  google_calendar_email: string | null;
  google_calendar_id: string | null;
  google_calendar_embed_url: string | null;
};

export default function TechOpsClientCalendarIntegration() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [embedUrl, setEmbedUrl] = useState("");
  const [savingEmbed, setSavingEmbed] = useState(false);

  const isValidEmbed = useMemo(() => {
    if (!embedUrl?.trim()) return true; // allow clearing
    // Minimal safety: only accept https URLs. You can tighten this later to only calendar.google.com or notion.so.
    try {
      const u = new URL(embedUrl.trim());
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }, [embedUrl]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/techops/clients/${clientId}/integrations`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load integration");
      setIntegration(json.integration);
      setEmbedUrl(json.integration?.google_calendar_embed_url || "");
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function saveEmbedUrl() {
    if (!isValidEmbed) {
      setError("Embed URL is not a valid https URL.");
      return;
    }
    setSavingEmbed(true);
    setError(null);
    try {
      const res = await fetch(`/api/techops/clients/${clientId}/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_calendar_embed_url: embedUrl.trim() ? embedUrl.trim() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save embed url");
      setIntegration(json.integration);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSavingEmbed(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Google Calendar Integration</h1>
          <p className="mt-1 text-sm opacity-70">
            Option A: paste a Google Calendar embed URL (fast, stable, no OAuth tokens).
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          {error}
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-6">
          {loading ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm opacity-70">Status</div>
                  <div className="mt-1 text-base font-medium">
                    {integration?.google_calendar_connected ? "Connected" : "Not connected"}
                  </div>
                </div>
                <Button variant="outline" onClick={load}>
                  Refresh
                </Button>
              </div>

              <div className="mt-6">
                <div className="text-sm font-medium">Embed URL</div>
                <div className="mt-2 flex flex-col gap-3">
                  <Input
                    placeholder="https://calendar.google.com/calendar/embed?src=..."
                    value={embedUrl}
                    onChange={(e) => setEmbedUrl(e.target.value)}
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={saveEmbedUrl} disabled={savingEmbed || !isValidEmbed}>
                      {savingEmbed ? "Saving..." : "Save"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => setEmbedUrl("")}
                      disabled={savingEmbed}
                    >
                      Clear
                    </Button>

                    {!isValidEmbed && (
                      <div className="text-sm text-red-400">
                        Must be a valid https URL.
                      </div>
                    )}
                  </div>

                  <div className="text-xs opacity-70">
                    The calendar owner must allow embed access (public OR shared appropriately). If the iframe shows a
                    permission screen, that’s a Google sharing issue—not your app.
                  </div>

                  {embedUrl.trim() && isValidEmbed && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
                      <iframe
                        title="Calendar Preview"
                        src={embedUrl.trim()}
                        className="w-full h-[600px]"
                        style={{ border: 0 }}
                        scrolling="no"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
