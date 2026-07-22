"use client";

export function DownloadButton({
  jobId,
  qualityScore,
}: {
  jobId: string;
  qualityScore: number | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6">
      <p className="font-medium text-green-800">
        skill.md prêt
        {qualityScore !== null && qualityScore >= 0 && ` — score qualité : ${qualityScore}/100`}
      </p>
      <div className="flex gap-3">
        <a
          href={`/api/jobs/${jobId}/download`}
          className="rounded-lg bg-gray-900 px-6 py-2.5 font-medium text-white transition-colors hover:bg-gray-700"
        >
          Télécharger skill.md
        </a>
        <a
          href={`/api/jobs/${jobId}/download?file=report`}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Rapport qualité
        </a>
      </div>
    </div>
  );
}
