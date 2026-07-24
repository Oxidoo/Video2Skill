import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf9f7",
          color: "#111827",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#2563eb" }}>Video2Skill</div>
        <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.1, marginTop: 24 }}>
          Finally, an AI that truly understands your videos
        </div>
        <div style={{ fontSize: 30, color: "#4b5563", marginTop: 28 }}>
          Timestamped transcription · OCR · visual analysis · skill.md
        </div>
      </div>
    ),
    { ...size }
  );
}
