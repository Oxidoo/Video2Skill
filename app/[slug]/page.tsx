import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTENT_PAGES, findContentPage } from "@/lib/content";
import { SITE } from "@/lib/site";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamicParams = false;

export function generateStaticParams() {
  return CONTENT_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = findContentPage(slug);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.description,
    keywords: [...page.keywords],
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: "article",
      url: `${SITE.url}/${page.slug}`,
      title: page.metaTitle,
      description: page.description,
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.description,
    },
  };
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 transition hover:bg-gray-50";

export default async function ContentPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = findContentPage(slug);
  if (!page) notFound();

  const related = CONTENT_PAGES.filter((p) => p.slug !== slug).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE.url}/${page.slug}#webpage`,
        url: `${SITE.url}/${page.slug}`,
        name: page.metaTitle,
        description: page.description,
        isPartOf: { "@id": `${SITE.url}/#website` },
        inLanguage: "en-US",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: page.h1, item: `${SITE.url}/${page.slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <nav className="text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600">
            Home
          </Link>{" "}
          / <span className="text-gray-600">{page.h1}</span>
        </nav>

        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900">{page.h1}</h1>

        <div className="mt-6 space-y-4 text-lg text-gray-600">
          {page.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard" className={primaryBtn}>
            Start for free
          </Link>
          <Link href="/pricing" className={secondaryBtn}>
            See pricing
          </Link>
        </div>

        {page.sections.map((s) => (
          <section key={s.h2} className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{s.h2}</h2>
            <p className="mt-3 text-gray-600">{s.body}</p>
          </section>
        ))}

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">What you get</h2>
          <ul className="mt-4 space-y-2">
            {page.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-gray-600">
                <span className="mt-1 text-emerald-500">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">FAQ</h2>
          <dl className="mt-4 divide-y divide-gray-100">
            {page.faq.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-semibold text-gray-900">{f.q}</dt>
                <dd className="mt-1.5 text-sm text-gray-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-2xl border border-gray-200 bg-gray-50/50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Related</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="text-blue-600 hover:underline">
                  {p.h1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>

      <SiteFooter />
    </main>
  );
}
