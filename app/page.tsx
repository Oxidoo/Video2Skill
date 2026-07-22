import Link from "next/link";
import { CREDITS_PER_MINUTE, SIGNUP_BONUS_CREDITS } from "@/lib/billing";

const STEPS = [
  ["1. Dépose ta vidéo", "Glisse une formation (mp4, mov, webm, mkv). L'upload est chunké, même pour les gros fichiers."],
  ["2. Traitement IA", "Transcription horodatée, extraction des captures clés, OCR et analyse visuelle de chaque écran."],
  ["3. skill.md fiable", "Procédures numérotées, repères visuels, timestamps et zones incertaines. Prêt pour une IA."],
];

const FEATURES = [
  ["Transcription horodatée", "Audio découpé et transcrit avec timestamps globaux."],
  ["Analyse visuelle des écrans", "Chaque capture est analysée : app, onglets, boutons, action probable."],
  ["OCR intégré", "Le texte à l'écran est extrait puis recoupé avec l'audio."],
  ["Contrôle qualité", "Une seconde passe IA note et corrige le skill.md, et signale les incertitudes."],
  ["Aucune étape inventée", "Pas d'étape UI générée à partir du seul audio, sans capture à l'appui."],
  ["Paiement à l'usage", "Des crédits consommés à la minute de vidéo. Pas d'abonnement."],
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {SIGNUP_BONUS_CREDITS} crédits offerts à l'inscription
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Transforme une vidéo de formation en <span className="text-blue-600">skill.md</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
          Video2Skill convertit tes tutoriels vidéo en une base de connaissances structurée et
          fiable, exploitable par une IA — avec timestamps, captures analysées et OCR.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
          >
            Commencer gratuitement
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Voir les tarifs
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {STEPS.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Un skill.md fiable, pas un résumé approximatif
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="mt-1.5 text-sm text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Prêt à essayer ?</h2>
          <p className="mt-2 text-gray-600">
            {CREDITS_PER_MINUTE} crédit{CREDITS_PER_MINUTE > 1 ? "s" : ""} par minute de vidéo.
            Connecte-toi avec Google et lance ta première conversion.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/dashboard"
              className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
            >
              Ouvrir le studio
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        Video2Skill — génération de skill.md à partir de vidéos.
      </footer>
    </main>
  );
}
