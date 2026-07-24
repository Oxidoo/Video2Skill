"use client";

import type { JobStatus } from "@/lib/types";
import { Spinner } from "./Spinner";

const STEPS: { key: string; label: string; stages: string[] }[] = [
  { key: "queue", label: "Queue", stages: ["queued", "created", "uploading", "uploaded"] },
  { key: "probe", label: "Video analysis", stages: ["probing"] },
  { key: "audio", label: "Audio extraction", stages: ["extracting_audio"] },
  { key: "transcribe", label: "Transcription", stages: ["transcribing"] },
  { key: "frames", label: "Frame extraction", stages: ["extracting_frames", "deduplicating"] },
  { key: "ocr", label: "OCR", stages: ["ocr"] },
  { key: "vision", label: "Visual analysis", stages: ["vision"] },
  { key: "merge", label: "Timeline merge", stages: ["merging"] },
  { key: "generate", label: "Output generation", stages: ["generating"] },
  { key: "qa", label: "Quality check", stages: ["quality_check"] },
];

export function ProgressPanel({ job }: { job: JobStatus }) {
  const activeIdx = STEPS.findIndex((s) => s.stages.includes(job.stage));
  const doneAll = job.status === "done";
  const failed = job.status === "failed";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed ? "bg-red-500" : "bg-blue-600"
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const done = doneAll || (activeIdx !== -1 && i < activeIdx);
          const active = !doneAll && !failed && i === activeIdx;
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  done
                    ? "bg-green-100 text-green-700"
                    : active
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : active ? <Spinner size={12} /> : i + 1}
              </span>
              <span
                className={
                  done
                    ? "text-gray-500"
                    : active
                      ? "font-medium text-gray-900"
                      : "text-gray-400"
                }
              >
                {step.label}
              </span>
              {active && job.message && (
                <span className="text-xs text-gray-400">{job.message}</span>
              )}
            </li>
          );
        })}
      </ol>
      {failed && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Error: {job.error}
        </p>
      )}
    </div>
  );
}
