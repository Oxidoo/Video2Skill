# Project: Video Skill Maker (Video2Skill)

## Goal
Build a local web application that converts a training video into a reliable `skill.md` knowledge base.

## Product requirements
- Local web app.
- Simple light theme.
- Single page.
- Drag and drop video upload.
- Chunked upload for large videos.
- Button to start processing.
- Progress status.
- Download generated `skill.md`.

## Technical stack
- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Local filesystem storage under `/data/jobs`.
- FFmpeg via child process (execa).
- Tesseract OCR via child process.
- OpenAI API for transcription.
- Anthropic API or OpenAI API for vision and synthesis (configurable via `.env.local`).
- No database for MVP.

## Processing pipeline
1. Upload video in chunks (20 MB).
2. Assemble video.
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
- Keep intermediate JSON files for debugging (`transcript.json`, `ocr.json`, `visual_analysis.json`, `timeline.json`, `report.json`).
- Do not delete source frames by default.

## Code quality
- Use small modular files (`src/lib/*`).
- Use Zod schemas for JSON validation (`src/lib/schemas.ts`).
- Use typed job status (`JobStage`).
- All long-running stages must update `job.json`.
- Handle failures gracefully (a failed frame must not sink the pipeline).
- Never hardcode API keys or model names — everything in `.env.local`.
