"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { Dropzone } from "./Dropzone";
import { ProgressPanel } from "./ProgressPanel";
import { DownloadButton } from "./DownloadButton";
import { Spinner } from "./Spinner";
import { isYoutubeUrl } from "@/lib/youtube";
import type { JobStatus } from "@/lib/types";

const CPM = Number(process.env.NEXT_PUBLIC_CREDITS_PER_MINUTE ?? 1);
const TMPC = Number(process.env.NEXT_PUBLIC_TRANSCRIPT_MINUTES_PER_CREDIT ?? 3);

type Phase = "idle" | "uploading" | "processing" | "done" | "error";
type Source = "file" | "youtube";
type OutputType = "skill" | "transcript";

function estimateCredits(durationSec: number, outputType: OutputType) {
  const minutes = Math.max(1, Math.ceil((durationSec || 0) / 60));
  return outputType === "transcript" ? Math.max(1, Math.ceil(minutes / TMPC)) : minutes * CPM;
}

function placeholderJob(id: string): JobStatus {
  return {
    id,
    fileName: "",
    status: "queued",
    stage: "queued",
    progress: 0,
    message: "Queued",
    error: null,
    durationSec: null,
    qualityScore: null,
    creditsReserved: 0,
    creditsCharged: null,
    skillUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function Studio() {
  const { data: session, update } = useSession();
  const credits = session?.user?.credits ?? 0;

  const [source, setSource] = useState<Source>("file");
  const [outputType, setOutputType] = useState<OutputType>("skill");

  const [file, setFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState(0);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytInfo, setYtInfo] = useState<{ durationSec: number; title: string | null } | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needCredits, setNeedCredits] = useState<{ required: number; available: number } | null>(
    null
  );
  const [options, setOptions] = useState({
    ultraPrecise: false,
    includeRawOcr: false,
    includeTimestamps: true,
    language: "auto" as "fr" | "en" | "auto",
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPoll(), []);

  // Refresh balance after returning from a successful Stripe purchase.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("purchase") === "success"
    ) {
      update();
    }
  }, [update]);

  // Look up YouTube duration/title to preview the cost.
  useEffect(() => {
    if (source !== "youtube") return;
    const u = youtubeUrl.trim();
    setYtInfo(null);
    if (!isYoutubeUrl(u)) return;
    let cancelled = false;
    setYtLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube-info?url=${encodeURIComponent(u)}`);
        const data = await res.json();
        if (!cancelled && res.ok) setYtInfo({ durationSec: data.durationSec, title: data.title });
      } catch {
        // ignore
      } finally {
        if (!cancelled) setYtLoading(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [youtubeUrl, source]);

  function handleFile(f: File) {
    setFile(f);
    setFileDuration(0);
    setNeedCredits(null);
    setError(null);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      window.URL.revokeObjectURL(v.src);
      setFileDuration(Number.isFinite(v.duration) ? v.duration : 0);
    };
    v.src = URL.createObjectURL(f);
  }

  const durationSec = source === "file" ? fileDuration : (ytInfo?.durationSec ?? 0);
  const knownDuration = durationSec > 0;
  const estimated = estimateCredits(durationSec, outputType);
  const insufficient = knownDuration && estimated > credits;
  const ready =
    source === "file"
      ? Boolean(file) && fileDuration > 0
      : isYoutubeUrl(youtubeUrl.trim());

  function poll(jobId: string) {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const j: JobStatus = await res.json();
        setJob(j);
        if (j.status === "done") {
          setPhase("done");
          stopPoll();
          update();
        } else if (j.status === "failed") {
          setPhase("error");
          setError(j.error);
          stopPoll();
          update();
        }
      } catch {
        // keep polling
      }
    }, 2000);
  }

  async function start() {
    if (!ready) return;
    setError(null);
    setNeedCredits(null);
    setUploadPct(0);
    try {
      const jobOptions = { ...options, outputType };
      let payload: Record<string, unknown>;

      if (source === "youtube") {
        setPhase("processing");
        payload = { youtubeUrl: youtubeUrl.trim(), options: jobOptions };
      } else {
        setPhase("uploading");
        const blob = await upload(file!.name, file!, {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: true,
          onUploadProgress: (p) => setUploadPct(Math.round(p.percentage)),
        });
        payload = {
          blobUrl: blob.url,
          fileName: file!.name,
          videoBytes: file!.size,
          durationSec: fileDuration,
          options: jobOptions,
        };
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 402) {
        setNeedCredits({ required: data.required, available: data.available });
        setPhase("error");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to create job");

      setJob(placeholderJob(data.jobId));
      setPhase("processing");
      poll(data.jobId);
      update();
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function reset() {
    stopPoll();
    setFile(null);
    setFileDuration(0);
    setYoutubeUrl("");
    setYtInfo(null);
    setPhase("idle");
    setUploadPct(0);
    setJob(null);
    setError(null);
    setNeedCredits(null);
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="flex flex-col gap-5">
      {/* Source tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
        {(["file", "youtube"] as Source[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => setSource(s)}
            className={`flex-1 rounded-lg px-3 py-2 transition ${
              source === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {s === "file" ? "Upload a file" : "YouTube link"}
          </button>
        ))}
      </div>

      {source === "file" ? (
        <Dropzone onFile={handleFile} disabled={busy} file={file} />
      ) : (
        <div>
          <input
            type="url"
            inputMode="url"
            disabled={busy}
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
          {source === "youtube" && ytLoading && (
            <p className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <Spinner size={12} /> Reading video…
            </p>
          )}
          {ytInfo?.title && (
            <p className="mt-2 truncate text-sm text-gray-700">🎬 {ytInfo.title}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Paste a public YouTube link. Make sure you have the rights to process it.
          </p>
        </div>
      )}

      {/* Output type */}
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["skill", "skill.md (complete)", "Full analysis: transcript + screens + procedures."],
            ["transcript", "Transcript only", "Just the timestamped text. Much cheaper."],
          ] as [OutputType, string, string][]
        ).map(([val, title, desc]) => (
          <button
            key={val}
            type="button"
            disabled={busy}
            onClick={() => setOutputType(val)}
            className={`rounded-xl border p-3 text-left transition ${
              outputType === val
                ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
          </button>
        ))}
      </div>

      {/* Cost line */}
      {ready && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="text-gray-600">
            {knownDuration ? (
              <>
                ≈ {Math.round(durationSec)}s · Estimated cost{" "}
                <strong className="text-gray-900">{estimated} credits</strong>
              </>
            ) : (
              <>Duration unknown — billed after processing</>
            )}
          </span>
          <span className={insufficient ? "text-red-600" : "text-emerald-700"}>
            Balance: {credits} credits
          </span>
        </div>
      )}

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Advanced options
        </summary>
        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.ultraPrecise}
              disabled={busy || outputType === "transcript"}
              onChange={(e) => setOptions({ ...options, ultraPrecise: e.target.checked })}
            />
            Ultra-precise mode (slower)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.includeTimestamps}
              disabled={busy}
              onChange={(e) => setOptions({ ...options, includeTimestamps: e.target.checked })}
            />
            Include detailed timestamps
          </label>
          <label className="flex items-center gap-2">
            Language:
            <select
              value={options.language}
              disabled={busy}
              onChange={(e) =>
                setOptions({ ...options, language: e.target.value as "fr" | "en" | "auto" })
              }
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="auto">Auto</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </label>
        </div>
      </details>

      {(phase === "idle" || phase === "error") && (
        <>
          {insufficient ? (
            <Link
              href="/pricing"
              className="rounded-lg bg-gray-900 px-6 py-3 text-center font-medium text-white hover:bg-gray-700"
            >
              Not enough credits — buy credits
            </Link>
          ) : (
            <button
              onClick={start}
              disabled={!ready}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {outputType === "transcript" ? "Get transcript" : "Create skill.md"}
              {ready && knownDuration ? ` (${estimated} credits)` : ""}
            </button>
          )}
        </>
      )}

      {phase === "uploading" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Spinner size={14} className="text-blue-600" />
            Uploading… {uploadPct}%
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {(phase === "processing" || phase === "done" || (phase === "error" && job)) && job && (
        <ProgressPanel job={job} />
      )}

      {phase === "processing" && job?.status === "queued" && (
        <p className="text-center text-xs text-gray-400">
          Processing starts as soon as a worker is available.
        </p>
      )}

      {phase === "done" && job && (
        <DownloadButton jobId={job.id} qualityScore={job.qualityScore} />
      )}

      {needCredits && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Not enough credits: {needCredits.required} required, {needCredits.available} available.{" "}
          <Link href="/pricing" className="font-medium underline">
            Buy credits
          </Link>
        </div>
      )}

      {phase === "error" && error && !needCredits && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Error: {error}</p>
      )}

      {(phase === "done" || phase === "error") && (
        <button onClick={reset} className="text-sm text-gray-500 underline hover:text-gray-700">
          Process another video
        </button>
      )}
    </div>
  );
}
