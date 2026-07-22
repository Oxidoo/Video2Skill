// Shape returned by GET /api/jobs/[id] and used across client components.
export interface JobStatus {
  id: string;
  fileName: string;
  status: string; // queued | processing | done | failed
  stage: string;
  progress: number;
  message: string;
  error: string | null;
  durationSec: number | null;
  qualityScore: number | null;
  creditsReserved: number;
  creditsCharged: number | null;
  skillUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
