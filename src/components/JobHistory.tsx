"use client";

import { useEffect, useRef, useState } from "react";
import type { JobStatus } from "@/lib/types";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  queued: { label: "En file", className: "bg-gray-100 text-gray-600" },
  processing: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  done: { label: "Terminé", className: "bg-green-100 text-green-700" },
  failed: { label: "Échec", className: "bg-red-100 text-red-700" },
};

export function JobHistory() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
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
          hasActive.current = list.some(
            (j) => j.status === "queued" || j.status === "processing"
          );
        }
      } catch {
        // ignore transient errors
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    // Refresh while any job is still active.
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
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {jobs.map((j) => {
          const s = STATUS_LABEL[j.status] ?? STATUS_LABEL.queued;
          return (
            <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{j.fileName}</p>
                <p className="text-xs text-gray-400">
                  {new Date(j.createdAt).toLocaleString("fr-FR")}
                  {j.creditsCharged != null && ` · ${j.creditsCharged} crédits`}
                </p>
                {j.status === "failed" && j.error && (
                  <p className="truncate text-xs text-red-600" title={j.error}>
                    {j.error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                  {s.label}
                </span>
                {j.status === "done" && (
                  <a
                    href={`/api/jobs/${j.id}/download`}
                    className="font-medium text-gray-700 underline hover:text-gray-900"
                  >
                    skill.md
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
