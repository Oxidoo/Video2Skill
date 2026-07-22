# Project: Video Skill Maker (Video2Skill)

## Goal
A hosted, commercial web application that converts a training video into a reliable `skill.md`
knowledge base. Public site with Google auth and pay-as-you-go credits.

## Architecture (hosted)
The FFmpeg + Tesseract + long-running pipeline cannot run on Vercel serverless, so the repo is
split into two deployables:
- **Web app** (Vercel): landing, Google auth, credits, Stripe billing, direct-to-blob upload,
  dashboard, download. Light and serverless-friendly.
- **Worker**: GitHub Actions drain mode (`.github/workflows/worker.yml`, woken by
  `repository_dispatch` on job creation, `npm run worker:drain`) or long-running container
  (`Dockerfile.worker`). Polls Postgres for `queued` jobs, runs the pipeline
  (`src/lib/pipeline-core.ts`), uploads `skill.md` to blob, settles credits.
- **Postgres** (Prisma): users, jobs, credit ledger (`CreditTransaction`).
- **Blob storage** (Vercel Blob): source videos + generated artifacts.

## Product requirements
- Hosted web app (Vercel), light theme.
- Google authentication (Auth.js / NextAuth v5).
- Pay-as-you-go credits (reserve on submit, settle on completion, refund on failure).
- Stripe checkout for buying credit packs.
- Drag and drop video upload, chunked/multipart for large videos.
- Progress status, download generated `skill.md`, job history.

## Technical stack
- Next.js App Router, TypeScript, Tailwind CSS.
- Auth.js (NextAuth v5) + Google, Prisma adapter.
- Prisma + PostgreSQL (Supabase — pooled `DATABASE_URL` port 6543 + `DIRECT_URL` port 5432).
- Vercel Blob storage (videos + outputs).
- Stripe for credit purchases.
- FFmpeg + Tesseract via child process (execa) — worker only.
- OpenAI API for transcription; Anthropic or OpenAI for vision/synthesis (configurable).
- Nothing hardcoded — all config via env vars.

## Processing pipeline
1. Upload video directly to blob storage (multipart) from the browser.
2. Create a `queued` job (credits reserved); worker downloads the video.
3. Extract metadata with ffprobe.
4. Extract audio with FFmpeg (mono 16 kHz WAV).
5. Split audio into 10-minute chunks.
6. Transcribe audio chunks with global timestamps.
7. Extract regular frames (1 per 5 s).
8. Extract scene-change frames (scene > 0.3).
9. Deduplicate frames (perceptual dHash).
10. OCR frames with Tesseract.
11. Analyze frames with vision model (strict JSON).
12. Merge transcript + OCR + vision into timeline.
13. Generate `skill.md`.
14. Run quality check (second AI pass).
15. Save final output.

## Reliability rules
- Never generate procedures from transcript alone if the procedure depends on UI.
- Every procedural step must be grounded in transcript, OCR, visual analysis, or timestamp.
- Mark uncertain UI elements as uncertain.
- Preserve timestamps (global, not per-chunk).
- Keep intermediate artifacts for debugging (skill.md, report.json, timeline.json uploaded to blob under `jobs/<id>/`).
- Do not delete source frames while a job is processing (worker cleans its temp dir after).

## Code quality
- Use small modular files (`src/lib/*`).
- Use Zod schemas for JSON validation (`src/lib/schemas.ts`).
- Use typed job status (`JobStage`).
- All long-running stages must update the `Job` row in Postgres (status/stage/progress/message).
- Handle failures gracefully (a failed frame must not sink the pipeline).
- Never hardcode API keys or model names — everything in `.env.local`.
