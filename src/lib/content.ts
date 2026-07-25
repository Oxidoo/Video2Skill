// Keyword-targeted landing pages (programmatic SEO). Each renders at /<slug>
// with unique content, metadata, JSON-LD and internal links.

export interface ContentPage {
  slug: string;
  h1: string;
  metaTitle: string;
  description: string;
  keywords: string[];
  intro: string[]; // paragraphs
  sections: { h2: string; body: string }[];
  bullets: string[];
  faq: { q: string; a: string }[];
}

export const CONTENT_PAGES: ContentPage[] = [
  {
    slug: "video-to-ai",
    h1: "Video to AI: let any AI understand a video",
    metaTitle: "Video to AI — Make Any AI Understand a Video",
    description:
      "Turn a video into AI-ready knowledge. Video2Skill converts any video into a structured skill.md — transcription, on-screen text and visual analysis — so ChatGPT, Claude or your own AI can actually use it.",
    keywords: ["video to ai", "video to skill", "make ai understand video", "ai video converter"],
    intro: [
      "Large language models can't watch a video. Paste a link and they see nothing — no words spoken, no buttons clicked, no text on screen. Video2Skill fixes that by turning a video into something an AI can actually read.",
      "It produces a clean skill.md file that captures what is said, what is shown and when — so your AI can answer questions, follow procedures and cite exact moments.",
    ],
    sections: [
      {
        h2: "Why a raw video doesn't work with AI",
        body: "A transcript alone misses the interface and the on-screen text; the audio alone leads models to invent steps. Video2Skill combines timestamped transcription, OCR of on-screen text and visual analysis of key frames, then grounds every step in real evidence.",
      },
      {
        h2: "One file, any model",
        body: "The output is plain Markdown (skill.md). Drop it into ChatGPT, Claude, Gemini, a RAG pipeline or your own agent — no lock-in, no special format.",
      },
    ],
    bullets: [
      "Timestamped transcription you can cite",
      "On-screen text captured with OCR",
      "Visual analysis of each key moment",
      "A quality pass that flags anything uncertain",
    ],
    faq: [
      {
        q: "Which AI tools can use the output?",
        a: "Any of them. The skill.md is standard Markdown, so it works with ChatGPT, Claude, Gemini, custom agents and RAG pipelines.",
      },
      {
        q: "Do I need to upload a file?",
        a: "Upload a video file — MP4, MOV, WEBM or MKV — including large ones, thanks to chunked upload.",
      },
    ],
  },
  {
    slug: "convert-video-to-skill-md",
    h1: "Convert a video to a skill.md file",
    metaTitle: "Convert a Video to skill.md — For AI Skills & Agents",
    description:
      "Convert any video into a reliable skill.md knowledge base for AI agents. Procedures, timestamps and visual cues, grounded in what's actually shown — not hallucinated.",
    keywords: ["convert video to skill", "skill.md", "video to skill.md", "ai skill from video"],
    intro: [
      "A skill.md is a structured knowledge file an AI agent can load to learn a task. Video2Skill builds one automatically from a video, so a recorded demo or walkthrough becomes a reusable AI skill.",
      "Instead of a vague summary, you get numbered procedures, prerequisites, visual landmarks and source timestamps.",
    ],
    sections: [
      {
        h2: "What goes into the skill.md",
        body: "Purpose, key concepts, step-by-step procedures with the software context, expected results, common mistakes, a glossary and a list of uncertain areas to verify — all derived from the transcript, OCR and on-screen analysis.",
      },
      {
        h2: "Grounded, not hallucinated",
        body: "No UI step is generated from audio alone. If the screen isn't legible, the file flags the uncertainty rather than guessing, so your agent stays trustworthy.",
      },
    ],
    bullets: [
      "Numbered, reproducible procedures",
      "Every step tied to a source timestamp",
      "Visual cues for each action",
      "A second AI pass scores and corrects the file",
    ],
    faq: [
      {
        q: "What is a skill.md exactly?",
        a: "A Markdown knowledge file structured so an AI can read and act on it: objective, procedures, timestamps, glossary and uncertainty notes.",
      },
      {
        q: "Can I get just the transcript instead?",
        a: "Yes. Choose the transcript-only mode for a cheaper, timestamped text export.",
      },
    ],
  },
  {
    slug: "mp4-to-text",
    h1: "MP4 to text: extract a video's content for AI",
    metaTitle: "MP4 to Text — Extract Video Content for AI",
    description:
      "Convert an MP4 (or MOV, WEBM, MKV) to text an AI can use. Timestamped transcript plus on-screen text and visual context — far more than a plain transcription.",
    keywords: ["mp4 to text", "video to text", "convert mp4 to text", "extract text from video"],
    intro: [
      "Need the content of an MP4 as text? Video2Skill goes beyond a plain transcript: it also reads the text on screen and describes what's happening, so nothing important is lost.",
      "Pick transcript-only for a quick, cheap timestamped text file, or the full skill.md when you need structured procedures.",
    ],
    sections: [
      {
        h2: "More than transcription",
        body: "Screen recordings are full of information the microphone never captures — menus, field values, error messages. OCR and visual analysis pull that in and align it with the spoken words on a single timeline.",
      },
      {
        h2: "Any common format",
        body: "MP4, MOV, WEBM and MKV are supported, including large files thanks to chunked upload — the video goes straight from your browser to storage, so size is not a problem.",
      },
    ],
    bullets: [
      "Timestamped text you can search and cite",
      "On-screen text captured via OCR",
      "Cheap transcript-only mode available",
      "Large files supported",
    ],
    faq: [
      {
        q: "Is it just speech-to-text?",
        a: "The transcript-only mode is timestamped speech-to-text. The full mode adds on-screen text and visual context for a complete picture.",
      },
      {
        q: "What formats can I upload?",
        a: "MP4, MOV, WEBM and MKV.",
      },
    ],
  },
  {
slug: "youtube-to-text",
    h1: "YouTube to text: turn a YouTube video into AI-ready notes",
    metaTitle: "YouTube to Text — Convert a YouTube Video for AI",
    description:
      "Turn a YouTube video into AI-ready text: a timestamped transcript, on-screen text and a structured skill.md. Save the video, drop it in, get a file any AI can read.",
    keywords: [
      "youtube to text",
      "youtube transcript",
      "youtube to ai",
      "convert youtube video to text",
    ],
    intro: [
      "Save the YouTube video to your computer, drop the file into Video2Skill, and get clean, timestamped text an AI can actually work with.",
      "Choose a quick transcript, or the full skill.md that also captures what appears on screen — the buttons, menus and dialogs a transcript can never record.",
    ],
    sections: [
      {
        h2: "Why you upload the file instead of pasting a link",
        body: "YouTube blocks automated downloads from server infrastructure, and any tool that claims otherwise is either fetching low-quality auto-captions or will break the week YouTube tightens its checks. We would rather ask you for one extra step than hand you a file that silently misses half the video. Save the video with any YouTube downloader, then upload it here.",
      },
      {
        h2: "What you get that captions don't give you",
        body: "YouTube's own captions record what was said, never what was shown. For a software tutorial that is the half that matters: the narrator says \"click here and set this to weekly\" and neither *here* nor *this* exists in the caption track. Video2Skill adds OCR of every on-screen label and a visual analysis of each key moment, so every step is tied to something actually visible.",
      },
      {
        h2: "Use it anywhere",
        body: "Feed the result to ChatGPT, Claude or your own agent to summarize, answer questions or follow a step-by-step procedure extracted from the tutorial.",
      },
    ],
    bullets: [
      "Timestamped transcript you can cite",
      "On-screen text captured with OCR",
      "Full skill.md option with visual context",
      "Cheaper transcript-only mode",
    ],
    faq: [
      {
        q: "Why can't I just paste a YouTube link?",
        a: "YouTube blocks automated downloads from datacenter servers. Rather than ship a feature that works one day and fails the next, we ask you to upload the file — which always works, for any video, at full quality.",
      },
      {
        q: "How do I save a YouTube video?",
        a: "Any YouTube downloader works, and YouTube Premium lets you download your own and others' videos officially. Only process videos you have the rights to.",
      },
      {
        q: "Isn't this the same as YouTube's automatic captions?",
        a: "No. Auto-captions are one imperfect text track. Video2Skill transcribes the audio directly, reads the on-screen text, and analyzes the interface at each key moment — then grounds every procedural step in that evidence.",
      },
      {
        q: "Does it keep timestamps?",
        a: "Yes, the transcript and skill.md keep global timestamps so an AI can cite exact moments.",
      },
    ],
  },
  {
    slug: "how-to-give-a-video-to-chatgpt",
    h1: "How to give a video to ChatGPT",
    metaTitle: "How to Give a Video to ChatGPT (or Claude)",
    description:
      "ChatGPT can't watch a video — but it can read one. Convert any video into a skill.md with Video2Skill, then paste it into ChatGPT or Claude.",
    keywords: ["give a video to chatgpt", "chatgpt video", "video for chatgpt", "claude video"],
    intro: [
      "ChatGPT and Claude can't open a video, but they're excellent at reading text. The trick is to turn the video into rich, structured text first.",
      "Video2Skill converts any video file into a skill.md you paste straight into your chat.",
    ],
    sections: [
      {
        h2: "Three steps",
        body: "1) Drop in your video file. 2) Let Video2Skill build the skill.md (transcript + on-screen text + visual analysis). 3) Download it and paste it into ChatGPT or Claude, then ask your questions.",
      },
      {
        h2: "Why not just paste a transcript?",
        body: "A transcript misses everything shown on screen. The skill.md keeps the visual context and timestamps, so the model's answers are accurate and citable.",
      },
    ],
    bullets: [
      "Works with ChatGPT, Claude and any LLM",
      "Any common video file",
      "Keeps timestamps and on-screen text",
      "Free credits to try it",
    ],
    faq: [
      {
        q: "Can ChatGPT watch the video directly?",
        a: "No. It reads text. Video2Skill converts the video to a text file ChatGPT can understand.",
      },
      {
        q: "How much does it cost?",
        a: "Pay as you go in credits, with free credits on sign-up. Transcript-only exports cost even less.",
      },
    ],
  },
];

export function findContentPage(slug: string): ContentPage | undefined {
  return CONTENT_PAGES.find((p) => p.slug === slug);
}
