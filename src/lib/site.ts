// Central site metadata reused across <head>, sitemap, robots and JSON-LD.

export const SITE = {
  name: "Video2Skill",
  // Canonical host, hardcoded so a stale Vercel env var can't override it.
  url: "https://www.video2skill.app",
  tagline: "The AI that truly understands your videos",
  description:
    "Video2Skill turns any video into a skill.md knowledge base your AI can read, cite and use: timestamped transcription, on-screen text (OCR) and visual analysis. The video-to-AI converter.",
  keywords: [
    "video to skill",
    "video2skill",
    "skill.md",
    "video to AI",
    "make an AI understand a video",
    "convert video for AI",
    "video to text for AI",
    "timestamped transcription",
    "video OCR",
    "analyze video with AI",
  ],
  locale: "en_US",
  twitter: "@video2skill",
} as const;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Video2Skill?",
    a: "Video2Skill is an online tool that lets an AI truly understand a video. It converts any video into a structured, reliable skill.md file an AI can use — combining timestamped transcription, on-screen text (OCR) and visual analysis.",
  },
  {
    q: "How do I convert a video for an AI?",
    a: "Sign in with Google, drop your video (or paste a link), then start. The tool automatically generates a skill.md with the content, timestamps and visual cues, which you download and give to your AI.",
  },
  {
    q: "How much does it cost?",
    a: "Pay as you go, in credits: 1 credit per minute of video for a full skill.md, and even less for a transcript-only export. Free credits on sign-up, no subscription.",
  },
  {
    q: "Which video formats are supported?",
    a: "Common formats are supported: MP4, MOV, WEBM and MKV, including large files thanks to chunked upload. You can also paste a public YouTube link.",
  },
  {
    q: "Is the skill.md reliable?",
    a: "Yes: no UI step is invented from audio alone. Every step is grounded in the transcript, OCR or visual analysis, and a quality check flags uncertain areas.",
  },
];
