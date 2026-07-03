import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video to Skill",
  description:
    "Transforme une formation vidéo en skill.md exploitable par une IA, avec timestamps, captures analysées, OCR et procédures.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
