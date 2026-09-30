import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";

// Social preview card (link unfurls on Slack/Discord/X/LinkedIn/iMessage).
// Generated once at build time, in the landing hero's own look: dark
// background, accent glow from the top, the wordmark and tagline. X falls
// back to this og:image too (layout.tsx sets a large-image Twitter card).

export const alt = "CrunchCast - know how a UBC course actually grades before you register";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a0b";
const FG = "#f2f2f3";
const MUTED = "#a3a3a3";
const SUBTLE = "#8a8a8a";
const ACCENT = "#ed462d";

export default async function OpengraphImage() {
  // Same Geist Mono the site uses, vendored in public/fonts for CourseGraph.
  const [regular, medium] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/GeistMono-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/GeistMono-Medium.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BG,
          backgroundImage: `radial-gradient(circle at 50% -10%, rgba(237, 70, 45, 0.32), transparent 55%)`,
          color: FG,
          fontFamily: "Geist Mono",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="44" height="44" viewBox="-0.6 2 20 20" fill="none">
            <path d="M14.74 4.48A8 8 0 1 0 14.74 19.52" stroke={FG} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M13.2 8.71A3.5 3.5 0 1 0 13.2 15.29" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 26, color: SUBTLE, letterSpacing: 4 }}>UBC COURSE DIFFICULTY</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 500, letterSpacing: -6, lineHeight: 1 }}>
            <span>Crunch</span>
            <span style={{ color: ACCENT }}>Cast</span>
          </div>
          {/* Satori lays spans out as separate flex items and mis-measures
              &nbsp;, so the word gaps around the accent phrase are explicit
              margins (one space in Geist Mono at 30px is 18px). */}
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
            <span>Know how a course</span>
            <span style={{ color: ACCENT, marginLeft: 18, marginRight: 18 }}>actually grades</span>
            <span>before you register.</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: SUBTLE }}>
          <span>Scores from decades of real UBC grade data</span>
          <span>{SITE_URL.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist Mono", data: regular, style: "normal", weight: 400 },
        { name: "Geist Mono", data: medium, style: "normal", weight: 500 },
      ],
    }
  );
}
