// Central site metadata reused across <head>, sitemap, robots and JSON-LD.
// Set NEXT_PUBLIC_APP_URL to your final domain to update canonical URLs everywhere.

export const SITE = {
  name: "Video2Skill",
  url: (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.video2skill.app").replace(/\/$/, ""),
  tagline: "Convertis une vidéo de formation en skill.md pour IA",
  description:
    "Video to Skill transforme une vidéo de formation en base de connaissances skill.md fiable pour une IA : transcription horodatée, OCR et analyse visuelle des écrans. Rapide, simple, paiement à l'usage.",
  keywords: [
    "video to skill",
    "video2skill",
    "skill.md",
    "vidéo en skill",
    "convertir une vidéo en documentation",
    "formation vidéo en IA",
    "transcription vidéo horodatée",
    "OCR vidéo",
    "documentation IA depuis vidéo",
    "générer skill.md",
  ],
  locale: "fr_FR",
  twitter: "@video2skill",
} as const;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce que Video to Skill ?",
    a: "Video2Skill est un outil en ligne qui convertit une vidéo de formation (tutoriel, démo logicielle) en un fichier skill.md structuré et fiable, exploitable par une IA. Il combine transcription horodatée, OCR et analyse visuelle des écrans.",
  },
  {
    q: "Comment convertir une vidéo en skill.md ?",
    a: "Connecte-toi avec Google, dépose ta vidéo (mp4, mov, webm, mkv), puis clique sur « Créer skill.md ». Le traitement génère automatiquement les procédures, timestamps et repères visuels, puis tu télécharges le fichier.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Le paiement se fait à l'usage, en crédits : 1 crédit par minute de vidéo. Des crédits sont offerts à l'inscription pour tester, sans abonnement.",
  },
  {
    q: "Quels formats de vidéo sont acceptés ?",
    a: "Les formats courants sont pris en charge : MP4, MOV, WEBM et MKV, y compris les fichiers volumineux grâce à l'upload par morceaux.",
  },
  {
    q: "Le skill.md est-il fiable ?",
    a: "Oui : aucune étape d'interface n'est inventée à partir du seul audio. Chaque étape est ancrée dans la transcription, l'OCR ou l'analyse visuelle, et un contrôle qualité signale les zones incertaines.",
  },
];
