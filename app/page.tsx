"use client";

import { useEffect, useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ProgressPanel } from "@/components/ProgressPanel";
import { DownloadButton } from "@/components/DownloadButton";
import type { JobState } from "@/lib/schemas";

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({
    ultraPrecise: false,
    includeRawOcr: false,
    includeTimestamps: true,
    language: "auto" as "fr" | "en" | "auto",
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function pollStatus(jobId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/job-status?jobId=${jobId}`);
        if (!res.ok) return;
        const state: JobState = await res.json();
        setJob(state);
        if (state.stage === "done") {
          setPhase("done");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (state.stage === "failed") {
          setPhase("error");
          setError(state.error);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // transient network error — keep polling
      }
    }, 1500);
  }

  async function start() {
    if (!file) return;
    setPhase("uploading");
    setError(null);
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let jobId: string | null = null;

      for (let i = 0; i < totalChunks; i++) {
        const form = new FormData();
        form.set("chunk", file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
        form.set("chunkIndex", String(i));
        form.set("fileName", file.name);
        if (jobId) form.set("jobId", jobId);
        else form.set("options", JSON.stringify(options));

        const res = await fetch("/api/upload-chunk", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        jobId = data.jobId;
        setUploadPct(Math.round(((i + 1) / totalChunks) * 100));
      }

      let res = await fetch("/api/complete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, totalChunks }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Assembly failed");

      res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Processing failed to start");

      setPhase("processing");
      pollStatus(jobId!);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setPhase("idle");
    setUploadPct(0);
    setJob(null);
    setError(null);
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Video Skill Maker</h1>
        <p className="mt-2 text-gray-500">
          Dépose une formation vidéo et génère un skill.md exploitable par une IA.
        </p>
      </header>

      <Dropzone onFile={setFile} disabled={busy} file={file} />

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

      {phase === "idle" || phase === "error" ? (
        <button
          onClick={start}
          disabled={!file}
          className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Créer skill.md
        </button>
      ) : null}

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

      {phase === "done" && job && (
        <DownloadButton jobId={job.jobId} qualityScore={job.qualityScore} />
      )}

      {phase === "error" && error && !job && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Erreur : {error}</p>
      )}

      {(phase === "done" || phase === "error") && (
        <button onClick={reset} className="text-sm text-gray-500 underline hover:text-gray-700">
          Traiter une autre vidéo
        </button>
      )}
    </main>
  );
}
