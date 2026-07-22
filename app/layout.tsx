import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Video2Skill — Transforme tes vidéos de formation en skill.md",
  description:
    "Convertis une formation vidéo en base de connaissances skill.md exploitable par une IA. Transcription horodatée, OCR, analyse visuelle. Paiement à l'usage en crédits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
