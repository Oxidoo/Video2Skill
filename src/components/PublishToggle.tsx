"use client";

import { useState } from "react";
import Link from "next/link";
import { Spinner } from "./Spinner";

/**
 * Opt-in publishing of a finished skill.md to a public page.
 *
 * Publishing puts a derivative of someone's video on the open web, so the
 * rights confirmation is a required checkbox rather than fine print — the API
 * rejects the request without it.
 */
export function PublishToggle({
  jobId,
  initialPublic,
  initialSlug,
}: {
  jobId: string;
  initialPublic: boolean;
  initialSlug: string | null;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [slug, setSlug] = useState(initialSlug);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmRights: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not publish.");
        return;
      }
      setSlug(data.slug);
      setIsPublic(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/publish`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not unpublish.");
        return;
      }
      setIsPublic(false);
      setConfirmed(false);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!slug) return;
    await navigator.clipboard.writeText(`${window.location.origin}/skills/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isPublic && slug) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-900">Published publicly</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={`/skills/${slug}`}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
          >
            View page
          </Link>
          <button
            onClick={copyLink}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            onClick={unpublish}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            {busy ? "…" : "Unpublish"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Share this skill publicly</p>
      <p className="mt-1 text-xs text-gray-500">
        Creates an indexable page at /skills/… anyone can read. Your video is never published — only
        the generated procedures.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I own this video or otherwise have the right to share procedures derived from it.
        </span>
      </label>
      <button
        onClick={publish}
        disabled={!confirmed || busy}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Spinner size={14} /> : null}
        Publish
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
