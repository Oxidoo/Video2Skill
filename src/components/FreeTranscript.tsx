"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "./Spinner";

type Phase = "idle" | "starting" | "processing" | "done" | "error";

interface Status {
  status: string;
  stage: string;
  progress: number;
  message: string;
  error: string | null;
  title: string;
  durationSec: number | null;
  sourceUrl: string | null;
  transcript: string | null;
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function fmtDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FreeTranscript() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [maxMinutes, setMaxMinutes] = useState(20);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/free-transcript")
      .then((r) => r.json())
      .then((d) => {
        if (d.enabled) {
          setQuota(d.quota);
          setMaxMinutes(d.maxMinutes);
        }
      })
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function poll(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/free-transcript/${jobId}`);
        if (!res.ok) return;
        const data: Status = await res.json();
        setStatus(data);
        if (data.status === "done") {
          setPhase("done");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setPhase("error");
          setError(data.error ?? "Processing failed.");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // transient — keep polling
      }
    }, 2500);
  }

  async function start() {
    setError(null);
    setStatus(null);
    setPhase("starting");
    try {
      const res = await fetch("/api/free-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setPhase("error");
        if (data.quota) setQuota(data.quota);
        return;
      }
      if (data.quota) setQuota(data.quota);
      setPhase("processing");
      poll(data.jobId);
    } catch {
      setError("Network error — please try again.");
      setPhase("error");
    }
  }

  async function copy() {
    if (!status?.transcript) return;
    await navigator.clipboard.writeText(status.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const busy = phase === "starting" || phase === "processing";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url && !busy) start();
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
          aria-label="YouTube video URL"
          disabled={busy}
        />
        <button onClick={start} disabled={!url || busy} className={primaryBtn}>
          {busy ? <Spinner /> : "Get transcript"}
        </button>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Free, no account. Public videos up to {maxMinutes} minutes
        {quota ? ` — ${quota.remaining} of ${quota.limit} left today` : ""}.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {phase === "processing" && status && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>{status.message || "Working…"}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all"
              style={{ width: `${Math.max(5, status.progress)}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && status?.transcript && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{status.title}</h3>
              {status.durationSec ? (
                <p className="text-sm text-gray-500">{fmtDuration(status.durationSec)}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(status.transcript)}`}
                download="transcript.txt"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Download .txt
              </a>
            </div>
          </div>

          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
            {status.transcript}
          </pre>

          {/* The transcript is the hook; the gap it leaves is the product. */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h4 className="font-semibold text-gray-900">
              This transcript can&apos;t tell an AI what was on screen
            </h4>
            <p className="mt-2 text-sm text-gray-700">
              Every click, menu, button label and dialog in this video is missing from the text
              above — so an AI reading it will invent the interface steps. A{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs">skill.md</code> adds OCR of
              on-screen text and a visual analysis of each key moment, so every procedure is
              grounded in what was actually shown.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Generate the skill.md for this video
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
