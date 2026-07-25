import Link from "next/link";
import { Logo } from "./Logo";
import { CONTENT_PAGES } from "@/lib/content";

const NAV_LABELS: Record<string, string> = {
  "video-to-ai": "Video to AI",
  "convert-video-to-skill-md": "Convert to skill.md",
  "mp4-to-text": "MP4 to text",
  "youtube-to-text": "YouTube to text",
  "how-to-give-a-video-to-chatgpt": "Video for ChatGPT",
};

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <Logo iconSize={22} wordmarkClassName="text-base font-bold tracking-tight text-gray-900" />
            <p className="mt-3 max-w-xs text-sm text-gray-500">
              The video-to-AI converter. Turn any video into a skill.md your AI can read and use.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-semibold text-gray-900">Product</p>
              <ul className="mt-3 space-y-2 text-gray-500">
                <li><Link href="/dashboard" className="hover:text-gray-900">Studio</Link></li>
                <li><Link href="/pricing" className="hover:text-gray-900">Pricing</Link></li>
                <li><Link href="/skills" className="hover:text-gray-900">Skill library</Link></li>
                <li>
                  <Link href="/free-youtube-transcript" className="hover:text-gray-900">
                    Free YouTube transcript
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Use cases</p>
              <ul className="mt-3 space-y-2 text-gray-500">
                {CONTENT_PAGES.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/${p.slug}`} className="hover:text-gray-900">
                      {NAV_LABELS[p.slug] ?? p.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-10 text-xs text-gray-400">
          © {new Date().getFullYear()} Video2Skill — skill.md from any video.
        </p>
      </div>
    </footer>
  );
}
