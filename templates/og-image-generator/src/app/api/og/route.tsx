import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "Your Title Here";
  const subtitle = searchParams.get("subtitle") || "Your subtitle goes here";
  const cta = searchParams.get("cta") || "Learn More";
  const theme = searchParams.get("theme") || "gradient";
  const from = searchParams.get("from") || "#6366f1";
  const to = searchParams.get("to") || "#8b5cf6";

  const backgrounds: Record<string, React.CSSProperties> = {
    gradient: {
      background: `linear-gradient(135deg, ${from}, ${to})`,
    },
    minimal: {
      background: "#ffffff",
      color: "#0a0a0a",
    },
    bold: {
      background: from,
    },
  };

  const bg = backgrounds[theme] || backgrounds.gradient;
  const isLight = theme === "minimal";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          color: isLight ? "#0a0a0a" : "#ffffff",
          ...bg,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 20,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 32,
            textAlign: "center",
            opacity: 0.85,
            marginBottom: 40,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            fontSize: 24,
            padding: "14px 40px",
            borderRadius: 12,
            background: isLight ? "#0a0a0a" : "rgba(255,255,255,0.2)",
            color: isLight ? "#ffffff" : "#ffffff",
            fontWeight: 600,
          }}
        >
          {cta}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
