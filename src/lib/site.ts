// Central site metadata reused across <head>, sitemap, robots and JSON-LD.
// Set NEXT_PUBLIC_APP_URL to your final domain to update canonical URLs everywhere.

export const SITE = {
  name: "Video2Skill",
  // Canonical host, hardcoded so a stale Vercel env var can't override it.
  // Change here if the domain ever changes.
  url: "https://www.video2skill.app",
  tagline: "L'IA qui comprend vraiment vos vidéos",
  description:
    "Video2Skill transforme n'importe quelle vidéo en une base de connaissances skill.md que votre IA peut lire, citer et exploiter : transcription horodatée, texte à l'écran (OCR) et analyse visuelle. Le convertisseur vidéo → IA.",
  keywords: [
    "video to skill",
    "video2skill",
    "skill.md",
    "comprendre une vidéo avec une IA",
    "convertir une vidéo pour une IA",
    "vidéo vers texte pour IA",
    "transcription vidéo horodatée",
    "OCR vidéo",
    "analyser une vidéo avec l'IA",
    "convertisseur vidéo IA",
  ],
  locale: "fr_FR",
  twitter: "@video2skill",
} as const;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce que Video2Skill ?",
    a: "Video2Skill est un outil en ligne qui permet à une IA de comprendre vraiment une vidéo. Il convertit n'importe quelle vidéo en un fichier skill.md structuré et fiable, exploitable par une IA — en combinant transcription horodatée, OCR du texte à l'écran et analyse visuelle.",
  },
  {
    q: "Comment convertir une vidéo pour une IA ?",
    a: "Connecte-toi avec Google, dépose ta vidéo (ou colle un lien), puis lance la conversion. L'outil génère automatiquement un skill.md avec le contenu, les timestamps et les repères visuels, que tu télécharges et donnes à ton IA.",
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
