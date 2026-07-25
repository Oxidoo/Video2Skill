import type { Metadata } from "next";
import Link from "next/link";
import { FreeTranscript } from "@/components/FreeTranscript";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";

const TITLE = "Free YouTube Transcript with Timestamps — No Sign-Up";
const DESCRIPTION =
  "Paste a YouTube link and get a clean, timestamped transcript in seconds. Free, no account, no watermark. Then turn the same video into a skill.md your AI can actually use.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "free youtube transcript",
    "youtube transcript with timestamps",
    "youtube to text",
    "transcribe youtube video free",
    "get youtube subtitles",
    "youtube transcript generator",
  ],
  alternates: { canonical: "/free-youtube-transcript" },
  openGraph: {
    type: "website",
    url: `${SITE.url}/free-youtube-transcript`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. No account, no card, no watermark. There is a daily cap per visitor so the tool stays available for everyone.",
  },
  {
    q: "How long can the video be?",
    a: "Up to 20 minutes on the free tool. Longer videos need an account, where transcripts cost one credit per three minutes.",
  },
  {
    q: "Does it work when the video has no subtitles?",
    a: "Yes. The audio is transcribed directly, so it works on videos that were never captioned and on captions that were auto-generated badly.",
  },
  {
    q: "Why would I need more than a transcript?",
    a: "A transcript records what was said, never what was shown. For any software tutorial, the buttons, menus and dialogs are missing — which is exactly what makes an AI invent steps. The skill.md output adds OCR of on-screen text and a visual analysis of each key moment.",
  },
  {
    q: "Can I use it on someone else's video?",
    a: "You can transcribe a public video for your own reading and research. Republishing the transcript is your responsibility and depends on the rights the video owner holds.",
  },
];

export default function FreeYoutubeTranscriptPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Free YouTube Transcript Generator",
        url: `${SITE.url}/free-youtube-transcript`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: DESCRIPTION,
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          {
            "@type": "ListItem",
            position: 2,
            name: "Free YouTube transcript",
            item: `${SITE.url}/free-youtube-transcript`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Free YouTube transcript, with timestamps
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Paste a link. Get a clean, timestamped transcript in seconds — no account, no card, no
          watermark.
        </p>

        <div className="mt-8">
          <FreeTranscript />
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            What a transcript gives you — and what it doesn&apos;t
          </h2>
          <p className="mt-3 text-gray-600">
            A transcript is a faithful record of the words. For a talk, an interview or a podcast,
            that is the whole content and the transcript is enough.
          </p>
          <p className="mt-3 text-gray-600">
            For anything demonstrated on a screen it is half the story. The narrator says
            &ldquo;then you click here and set this to weekly&rdquo; — and <em>here</em> and{" "}
            <em>this</em> exist only in the pixels. Hand that transcript to an AI and it will fill
            the gaps with a plausible interface that does not exist, confidently. That failure mode
            is the reason this tool exists.
          </p>
          <p className="mt-3 text-gray-600">
            The paid output, a{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">skill.md</code>, adds two
            evidence sources the transcript cannot carry: OCR of every on-screen label, and a visual
            analysis of each key frame. Every procedural step is then tied to something that was
            actually shown, and anything illegible is marked uncertain instead of guessed.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Questions</h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-gray-900">{f.q}</dt>
                <dd className="mt-1 text-gray-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">Keep going</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/video-to-ai" className="text-blue-600 hover:underline">
                Make any AI understand a video
              </Link>
            </li>
            <li>
              <Link href="/convert-video-to-skill-md" className="text-blue-600 hover:underline">
                Convert a video to a skill.md file
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-blue-600 hover:underline">
                Pricing and credits
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
