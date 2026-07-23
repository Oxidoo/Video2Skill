"use client";

import { useEffect, useRef, useState } from "react";
import type { JobStatus } from "@/lib/types";
import { ProgressPanel } from "./ProgressPanel";
import { DownloadButton } from "./DownloadButton";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  queued: { label: "En file", className: "bg-gray-100 text-gray-600" },
  processing: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  done: { label: "Terminé", className: "bg-green-100 text-green-700" },
  failed: { label: "Échec", className: "bg-red-100 text-red-700" },
};

function isActive(status: string) {
  return status === "queued" || status === "processing";
}

/** Expanded panel: polls the job live while it is still active. */
function JobDetail({ initial }: { initial: JobStatus }) {
  const [job, setJob] = useState<JobStatus>(initial);

  useEffect(() => {
    setJob(initial);
    if (!isActive(initial.status)) return;
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/jobs/${initial.id}`);
        if (res.ok) {
          const j: JobStatus = await res.json();
          if (!stopped) setJob(j);
          if (!isActive(j.status)) return; // terminal — stop polling
        }
      } catch {
        // transient — keep polling
      }
      if (!stopped) setTimeout(tick, 2000);
    }
    const t = setTimeout(tick, 1500);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [initial.id, initial.status]);

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
      <ProgressPanel job={job} />
      {job.status === "done" && (
        <div className="mt-3">
          <DownloadButton jobId={job.id} qualityScore={job.qualityScore} />
        </div>
      )}
    </div>
  );
}

export function JobHistory() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasActive = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const list: JobStatus[] = data.jobs ?? [];
          setJobs(list);
          hasActive.current = list.some((j) => isActive(j.status));
        }
      } catch {
        // ignore transient errors
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    timer.current = setInterval(() => {
      if (hasActive.current) load();
    }, 5000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  if (!loaded || jobs.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Historique
      </h2>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {jobs.map((j) => {
          const s = STATUS_LABEL[j.status] ?? STATUS_LABEL.queued;
          const expanded = expandedId === j.id;
          return (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : j.id)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{j.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(j.createdAt).toLocaleString("fr-FR")}
                      {j.creditsCharged != null && ` · ${j.creditsCharged} crédits`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {isActive(j.status) && (
                    <span className="text-xs tabular-nums text-blue-600">{j.progress}%</span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
                  >
                    {s.label}
                  </span>
                </div>
              </button>
              {expanded && <JobDetail initial={j} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
