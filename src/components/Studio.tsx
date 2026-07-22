"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { Dropzone } from "./Dropzone";
import { ProgressPanel } from "./ProgressPanel";
import { DownloadButton } from "./DownloadButton";
import type { JobStatus } from "@/lib/types";

const CREDITS_PER_MINUTE = Number(process.env.NEXT_PUBLIC_CREDITS_PER_MINUTE ?? 1);

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

function estimateCredits(durationSec: number) {
  const minutes = Math.max(1, Math.ceil((durationSec || 0) / 60));
  return minutes * CREDITS_PER_MINUTE;
}

function placeholderJob(id: string): JobStatus {
  return {
    id,
    fileName: "",
    status: "queued",
    stage: "queued",
    progress: 0,
    message: "En file d'attente",
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

  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState(0);
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

  // Refresh the balance after coming back from a successful Stripe purchase.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("purchase") === "success"
    ) {
      update();
    }
  }, [update]);

  function handleFile(f: File) {
    setFile(f);
    setDurationSec(0);
    setNeedCredits(null);
    setError(null);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      window.URL.revokeObjectURL(v.src);
      setDurationSec(Number.isFinite(v.duration) ? v.duration : 0);
    };
    v.src = URL.createObjectURL(f);
  }

  const estimated = estimateCredits(durationSec);
  const insufficient = durationSec > 0 && estimated > credits;

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
        // transient error — keep polling
      }
    }, 2000);
  }

  async function start() {
    if (!file) return;
    setPhase("uploading");
    setError(null);
    setNeedCredits(null);
    setUploadPct(0);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: true,
        onUploadProgress: (p) => setUploadPct(Math.round(p.percentage)),
      });

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          fileName: file.name,
          videoBytes: file.size,
          durationSec,
          options,
        }),
      });
      const data = await res.json();

      if (res.status === 402) {
        setNeedCredits({ required: data.required, available: data.available });
        setPhase("error");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Création du job échouée");

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
    setDurationSec(0);
    setPhase("idle");
    setUploadPct(0);
    setJob(null);
    setError(null);
    setNeedCredits(null);
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="flex flex-col gap-5">
      <Dropzone onFile={handleFile} disabled={busy} file={file} />

      {file && durationSec > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="text-gray-600">
            Durée ≈ {Math.round(durationSec)} s · Coût estimé{" "}
            <strong className="text-gray-900">{estimated} crédits</strong>
          </span>
          <span className={insufficient ? "text-red-600" : "text-emerald-700"}>
            Solde : {credits} crédits
          </span>
        </div>
      )}

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Options avancées
        </summary>
        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.ultraPrecise}
              disabled={busy}
              onChange={(e) => setOptions({ ...options, ultraPrecise: e.target.checked })}
            />
            Mode ultra précis, plus lent
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.includeRawOcr}
              disabled={busy}
              onChange={(e) => setOptions({ ...options, includeRawOcr: e.target.checked })}
            />
            Inclure OCR brut dans le rapport
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.includeTimestamps}
              disabled={busy}
              onChange={(e) => setOptions({ ...options, includeTimestamps: e.target.checked })}
            />
            Inclure timestamps détaillés
          </label>
          <label className="flex items-center gap-2">
            Langue :
            <select
              value={options.language}
              disabled={busy}
              onChange={(e) =>
                setOptions({ ...options, language: e.target.value as "fr" | "en" | "auto" })
              }
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="auto">Auto</option>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
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
              Crédits insuffisants — acheter des crédits
            </Link>
          ) : (
            <button
              onClick={start}
              disabled={!file || durationSec === 0}
              className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Créer skill.md {file && durationSec > 0 ? `(${estimated} crédits)` : ""}
            </button>
          )}
        </>
      )}

      {phase === "uploading" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="mb-2 text-sm font-medium text-gray-700">Upload… {uploadPct}%</p>
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
          Le traitement démarre dès qu'un worker est disponible.
        </p>
      )}

      {phase === "done" && job && (
        <DownloadButton jobId={job.id} qualityScore={job.qualityScore} />
      )}

      {needCredits && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Crédits insuffisants : {needCredits.required} requis, {needCredits.available} disponibles.{" "}
          <Link href="/pricing" className="font-medium underline">
            Acheter des crédits
          </Link>
        </div>
      )}

      {phase === "error" && error && !needCredits && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Erreur : {error}</p>
      )}

      {(phase === "done" || phase === "error") && (
        <button
          onClick={reset}
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          Traiter une autre vidéo
        </button>
      )}
    </div>
  );
}
