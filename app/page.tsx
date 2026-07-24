import Link from "next/link";
import { CREDITS_PER_MINUTE, SIGNUP_BONUS_CREDITS } from "@/lib/billing";
import { FAQ } from "@/lib/site";
import { CONTENT_PAGES } from "@/lib/content";
import { SiteFooter } from "@/components/SiteFooter";

const PROBLEMS = [
  ["Audio isn't enough", "A transcript alone misses everything on screen: buttons, menus, interfaces, on-screen text."],
  ["No time anchors", "Without timestamps, an AI can't cite or locate a precise moment in the video."],
  ["Hallucination risk", "From audio alone, an AI makes up steps. Every fact must be grounded in what's actually shown."],
];

const STEPS = [
  ["Add your video", "Drop a file (mp4, mov, webm, mkv) or paste a link. Even large files work."],
  ["The AI analyzes everything", "Timestamped transcription, key frames, on-screen OCR and visual analysis of each moment."],
  ["Get your skill.md", "A structured file, with timestamps and visual cues, ready to be read by any AI."],
];

const FEATURES = [
  ["Timestamped transcription", "Audio is transcribed with global, citable timestamps."],
  ["Visual screen analysis", "Every frame is understood: app, tabs, buttons, likely action."],
  ["Built-in OCR", "On-screen text is extracted and cross-checked with the audio."],
  ["AI quality check", "A second pass scores, corrects and flags uncertain areas."],
  ["Zero invention", "No step is generated from audio alone without visual evidence."],
  ["Pay as you go", "Credits spent per minute. No subscription."],
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 transition hover:bg-gray-50";

export default function LandingPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-14 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {SIGNUP_BONUS_CREDITS} free credits — no credit card
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-6xl">
          Finally, an AI that truly
          <br className="hidden sm:block" /> understands your{" "}
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            videos
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Video2Skill turns any video into a{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.95em] text-gray-800">skill.md</code>{" "}
          knowledge base your AI can read, cite and use — timestamped transcription, on-screen text
          and visual analysis.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={primaryBtn}>
            Start for free
          </Link>
          <Link href="/pricing" className={secondaryBtn}>
            See pricing
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
          <span>✓ Timestamped transcription</span>
          <span>✓ On-screen OCR</span>
          <span>✓ Visual analysis</span>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-gray-900">
            An AI can&apos;t &ldquo;see&rdquo; a video on its own
          </h2>
          <p className="mt-3 max-w-2xl text-gray-600">
            Handing a raw video to a model doesn&apos;t work. Here&apos;s why.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {PROBLEMS.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6">
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">How it works</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <div key={title}>
              <div className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-4xl font-extrabold text-transparent">
                0{i + 1}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            A reliable skill.md, not a vague summary
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Frequently asked questions</h2>
        <dl className="mt-8 divide-y divide-gray-100">
          {FAQ.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-semibold text-gray-900">{f.q}</dt>
              <dd className="mt-2 text-sm text-gray-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Final CTA */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Give your AI real eyes
          </h2>
          <p className="mt-3 text-gray-600">
            {CREDITS_PER_MINUTE} credit{CREDITS_PER_MINUTE > 1 ? "s" : ""} per minute of video.{" "}
            {SIGNUP_BONUS_CREDITS} free to start.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/dashboard" className={primaryBtn}>
              Open the studio
            </Link>
          </div>
        </div>
      </section>

      {/* Use cases — internal links */}
      <section className="mx-auto max-w-5xl px-6 pb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Popular use cases
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {CONTENT_PAGES.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
            >
              {p.h1.split(":")[0]}
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
