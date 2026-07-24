import Link from "next/link";
import { CREDITS_PER_MINUTE, SIGNUP_BONUS_CREDITS } from "@/lib/billing";
import { FAQ } from "@/lib/site";
import { Logo } from "@/components/Logo";

const PROBLEMS = [
  ["L'audio ne suffit pas", "Une transcription seule rate tout ce qui se passe à l'écran : boutons, menus, interfaces, textes affichés."],
  ["Pas de repères temporels", "Sans timestamps, une IA ne peut ni citer ni situer un moment précis de la vidéo."],
  ["Risque d'hallucination", "À partir du seul son, une IA invente des étapes. Il faut ancrer chaque information dans ce qui est réellement montré."],
];

const STEPS = [
  ["Dépose ta vidéo", "Glisse un fichier (mp4, mov, webm, mkv) ou colle un lien. Même les gros fichiers passent."],
  ["L'IA analyse tout", "Transcription horodatée, captures clés, OCR du texte à l'écran et analyse visuelle de chaque moment."],
  ["Récupère ton skill.md", "Un fichier structuré, avec timestamps et repères visuels, prêt à être lu par n'importe quelle IA."],
];

const FEATURES = [
  ["Transcription horodatée", "L'audio est transcrit avec des timestamps globaux, citables."],
  ["Analyse visuelle des écrans", "Chaque capture est comprise : application, onglets, boutons, action probable."],
  ["OCR intégré", "Le texte affiché à l'écran est extrait puis recoupé avec l'audio."],
  ["Contrôle qualité IA", "Une seconde passe note, corrige et signale les zones incertaines."],
  ["Zéro invention", "Aucune étape générée à partir du seul son sans preuve visuelle à l'appui."],
  ["Paiement à l'usage", "Des crédits consommés à la minute. Aucun abonnement."],
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
          {SIGNUP_BONUS_CREDITS} crédits offerts — sans carte bancaire
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-6xl">
          Enfin, une IA qui comprend
          <br className="hidden sm:block" /> vraiment vos{" "}
          <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            vidéos
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Video2Skill transforme n'importe quelle vidéo en une base de connaissances{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.95em] text-gray-800">skill.md</code>{" "}
          que votre IA peut lire, citer et exploiter — transcription horodatée, texte à l'écran et
          analyse visuelle.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={primaryBtn}>
            Commencer gratuitement
          </Link>
          <Link href="/pricing" className={secondaryBtn}>
            Voir les tarifs
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
          <span>✓ Transcription horodatée</span>
          <span>✓ OCR du texte à l'écran</span>
          <span>✓ Analyse visuelle</span>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-gray-900">
            Une IA ne « voit » pas une vidéo toute seule
          </h2>
          <p className="mt-3 max-w-2xl text-gray-600">
            Donner une vidéo brute à un modèle ne marche pas. Voilà pourquoi.
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
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Comment ça marche</h2>
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
            Un skill.md fiable, pas un résumé approximatif
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
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Questions fréquentes</h2>
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
            Donnez de vrais yeux à votre IA
          </h2>
          <p className="mt-3 text-gray-600">
            {CREDITS_PER_MINUTE} crédit{CREDITS_PER_MINUTE > 1 ? "s" : ""} par minute de vidéo.{" "}
            {SIGNUP_BONUS_CREDITS} offerts pour commencer.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/dashboard" className={primaryBtn}>
              Ouvrir le studio
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-gray-500 sm:flex-row">
          <Logo iconSize={22} wordmarkClassName="text-base font-bold tracking-tight text-gray-900" />
          <p>Le convertisseur vidéo → IA. skill.md à partir de n'importe quelle vidéo.</p>
        </div>
      </footer>
    </main>
  );
}
