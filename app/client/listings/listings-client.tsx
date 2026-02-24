"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ListingRow = {
  id: string;
  status: string | null;
  created_at: string;
  address?: string | null;
  caption?: string | null;
};

type ListingFile = {
  id: string;
  file_path: string;
  file_type: string;
  url: string;
};

type ListingDetails = {
  listing: {
    id: string;
    status: string | null;
    created_at: string;
    address?: string | null;
    caption?: string | null;
  };
  files: ListingFile[];
};

type ListingsClientProps = {
  client: {
    id: string;
    business_name: string | null;
    industry: string | null;
  };
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusPill(status?: string | null) {
  const s = (status || "uploaded").toLowerCase();
  if (s === "approved" || s === "published") return "bg-emerald-500/10 text-emerald-300 border-emerald-400/20";
  if (s === "processing") return "bg-amber-500/10 text-amber-300 border-amber-400/20";
  if (s === "error") return "bg-red-500/10 text-red-300 border-red-400/20";
  return "bg-white/5 text-white/80 border-white/10";
}

export default function ListingsClient({ client }: ListingsClientProps) {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeListing, setActiveListing] = useState<ListingDetails | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadListings() {
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch("/api/listings/list", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        setLoadError(text || `Failed (${res.status})`);
        setListings([]);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setListings(Array.isArray(json?.listings) ? json.listings : []);
      setLoading(false);
    } catch (e: unknown) {
      setLoadError(getErrorMessage(e) || "Failed to load listings.");
      setListings([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadListings();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setUploadError(null);
    setUploadSuccess(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/listings/create", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      if (!res.ok) {
        setUploadError(text || `Failed (${res.status})`);
        setSubmitting(false);
        return;
      }

      setUploadSuccess("Listing uploaded.");
      form.reset();
      await loadListings();
      setSubmitting(false);
    } catch (err: unknown) {
      setUploadError(getErrorMessage(err) || "Upload failed.");
      setSubmitting(false);
    }
  }

  async function viewListing(listingId: string) {
    setActiveError(null);
    setActiveLoading(true);
    setActiveListing(null);
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        setActiveError(text || `Failed (${res.status})`);
        setActiveLoading(false);
        return;
      }
      const json = await res.json();
      setActiveListing(json as ListingDetails);
      setActiveLoading(false);
    } catch (err: unknown) {
      setActiveError(getErrorMessage(err) || "Failed to load listing details.");
      setActiveLoading(false);
    }
  }

  function closeModal() {
    setActiveListing(null);
    setActiveError(null);
    setActiveLoading(false);
  }

  async function deleteListing(listingId: string) {
    if (deletingId) return;
    const confirmDelete = window.confirm("Delete this listing and all uploaded files?");
    if (!confirmDelete) return;

    setDeletingId(listingId);
    setUploadError(null);
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        setUploadError(text || `Failed (${res.status})`);
        setDeletingId(null);
        return;
      }
      if (activeListing?.listing.id === listingId) closeModal();
      await loadListings();
      setDeletingId(null);
    } catch (err: unknown) {
      setUploadError(getErrorMessage(err) || "Delete failed.");
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950/60 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Real Estate Listings</h1>
            <div className="mt-1 text-sm opacity-70">
              {client.business_name || "Client"} • {client.industry || "—"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/client/dashboard">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">Upload New Listing</div>
            <div className="text-sm opacity-70 mt-1">MLS file (PDF or CSV) + property photos</div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="text-sm opacity-80">MLS File</label>
                <input
                  name="mlsFile"
                  type="file"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  required
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm opacity-80">Property Photos</label>
                <input
                  name="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                />
              </div>

              {uploadError ? (
                <div className="text-sm text-red-300 break-all">{uploadError}</div>
              ) : null}
              {uploadSuccess ? (
                <div className="text-sm text-emerald-300">{uploadSuccess}</div>
              ) : null}

              <Button type="submit" disabled={submitting}>
                {submitting ? "Uploading..." : "Submit"}
              </Button>
            </form>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-lg font-semibold">Previous Uploads</div>
                <div className="text-sm opacity-70">Listings for this client</div>
              </div>
              <Button variant="secondary" onClick={loadListings}>
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="mt-6 text-sm opacity-70">Loading listings...</div>
            ) : loadError ? (
              <div className="mt-6 text-sm text-red-300 break-all">{loadError}</div>
            ) : listings.length === 0 ? (
              <div className="mt-6 text-sm opacity-70">No uploads yet.</div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide opacity-60 border-b border-white/10">
                      <th className="py-2 pr-3">Address</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {listings.map((l) => (
                      <tr key={l.id}>
                        <td className="py-3 pr-3">{l.address || "—"}</td>
                        <td className="py-3 pr-3">
                          <span className={`rounded-full border px-2 py-1 text-xs ${statusPill(l.status)}`}>
                            {l.status || "uploaded"}
                          </span>
                        </td>
                        <td className="py-3 pr-3">{formatDate(l.created_at)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => viewListing(l.id)}
                              className="rounded-md border border-white/10 px-2 py-1 text-xs opacity-80 hover:opacity-100"
                            >
                              View
                            </button>
                            <button className="rounded-md border border-white/10 px-2 py-1 text-xs opacity-80 hover:opacity-100">
                              Re-run
                            </button>
                            <button
                              onClick={() => deleteListing(l.id)}
                              disabled={deletingId === l.id}
                              className="rounded-md border border-white/10 px-2 py-1 text-xs opacity-80 hover:opacity-100 disabled:opacity-50"
                            >
                              {deletingId === l.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {(activeLoading || activeError || activeListing) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#090b0f] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Listing Preview</div>
                <div className="text-sm opacity-70">
                  {activeListing?.listing.address || "Address not available"}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-md border border-white/10 px-3 py-1 text-xs opacity-80 hover:opacity-100"
              >
                Close
              </button>
            </div>

            {activeLoading ? (
              <div className="mt-6 text-sm opacity-70">Loading preview...</div>
            ) : activeError ? (
              <div className="mt-6 text-sm text-red-300 break-all">{activeError}</div>
            ) : activeListing ? (
              <>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeListing.files.map((file) => {
                    const isImage = file.file_type === "photo";
                    const isPdf = file.file_path.toLowerCase().endsWith(".pdf");
                    return (
                      <div
                        key={file.id}
                        className="rounded-xl border border-white/10 bg-black/30 p-3"
                      >
                        <div className="text-xs uppercase opacity-60 mb-2">{file.file_type}</div>
                        {isImage ? (
                          <img
                            src={file.url}
                            alt="Listing asset"
                            className="w-full h-52 object-cover rounded-lg border border-white/10"
                          />
                        ) : isPdf ? (
                          <iframe
                            title={file.file_path}
                            src={file.url}
                            className="w-full h-52 rounded-lg border border-white/10 bg-white"
                          />
                        ) : (
                          <div className="h-52 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-sm opacity-80">
                            Preview not available
                          </div>
                        )}
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-xs underline opacity-80 hover:opacity-100"
                        >
                          Open file
                        </a>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm uppercase tracking-wide opacity-60">New Listing Caption</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                    {activeListing.listing.caption ||
                      "Caption is not ready yet. The n8n workflow may still be processing."}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
