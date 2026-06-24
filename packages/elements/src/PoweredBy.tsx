import { useEffect, useState, type CSSProperties } from "react";

export interface PoweredByProps {
  /**
   * Visual theme. `"auto"` follows the host's `prefers-color-scheme`.
   * @default "auto"
   */
  theme?: "light" | "dark" | "auto";
  /**
   * Layout. `"badge"` renders a bordered pill; `"inline"` renders a bare
   * text link that sits inside a sentence or footer.
   * @default "badge"
   */
  variant?: "badge" | "inline";
  /**
   * Attribution tag. Appended as `utm_campaign` so you can see in analytics
   * which app a click came from. Use your app or template name.
   * @default "powered-by"
   */
  campaign?: string;
  /** Override the destination entirely (skips the built-in referral params). */
  href?: string;
  /** Extra class on the anchor, for further styling hooks. */
  className?: string;
  /** Inline style overrides merged onto the anchor. */
  style?: CSSProperties;
}

const BASE_URL = "https://llmgateway.io/";

function buildHref(campaign: string, override?: string): string {
  if (override) {
    return override;
  }
  const params = new URLSearchParams({
    utm_source: "powered-by",
    utm_medium: "badge",
    utm_campaign: campaign,
    ref: "powered-by",
  });
  return `${BASE_URL}?${params.toString()}`;
}

/** The LLM Gateway mark — an abstract "gateway" the requests route through. */
function GatewayGlyph({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="3.5"
        stroke={color}
        strokeWidth="1.4"
        opacity="0.55"
      />
      <path
        d="M5 8h6M8.4 5.4 11 8l-2.6 2.6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Resolved = "light" | "dark";

const PALETTE: Record<
  Resolved,
  { fg: string; muted: string; bg: string; border: string; hoverBg: string }
> = {
  light: {
    fg: "#18181b",
    muted: "#52525b",
    bg: "#ffffff",
    border: "#e4e4e7",
    hoverBg: "#fafafa",
  },
  dark: {
    fg: "#fafafa",
    muted: "#a1a1aa",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.14)",
    hoverBg: "rgba(255,255,255,0.08)",
  },
};

/**
 * "Powered by LLM Gateway" attribution badge.
 *
 * Fully self-contained — no stylesheet import required — so it can be dropped
 * into any app or copied verbatim. Every render is a referral-tagged link back
 * to LLM Gateway. Shipped by default inside `<BuyCredits>`; add it to your own
 * footer to turn each deployment into an impression.
 *
 * ```tsx
 * <PoweredBy campaign="my-app" theme="dark" />
 * ```
 */
export function PoweredBy(props: PoweredByProps) {
  const {
    theme = "auto",
    variant = "badge",
    campaign = "powered-by",
    href,
    className,
    style,
  } = props;

  const [systemDark, setSystemDark] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const resolved: Resolved =
    theme === "auto" ? (systemDark ? "dark" : "light") : theme;
  const c = PALETTE[resolved];
  const active = hover || focus;

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4em",
    font: "inherit",
    fontSize: "0.8125rem",
    lineHeight: 1,
    fontWeight: 500,
    letterSpacing: "0.01em",
    textDecoration: "none",
    color: c.muted,
    transition: "color 120ms ease, background 120ms ease, border-color 120ms ease",
    WebkitFontSmoothing: "antialiased",
  };

  const variantStyle: CSSProperties =
    variant === "badge"
      ? {
          padding: "0.375rem 0.625rem",
          borderRadius: "999px",
          border: `1px solid ${active ? c.fg : c.border}`,
          background: active ? c.hoverBg : c.bg,
          color: active ? c.fg : c.muted,
        }
      : {
          color: active ? c.fg : c.muted,
          borderBottom: `1px solid ${active ? c.fg : "transparent"}`,
          paddingBottom: "1px",
        };

  return (
    <a
      href={buildHref(campaign, href)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="Powered by LLM Gateway"
      style={{ ...baseStyle, ...variantStyle, ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <GatewayGlyph color={active ? c.fg : c.muted} />
      <span>
        Powered by{" "}
        <span style={{ color: c.fg, fontWeight: 600 }}>LLM Gateway</span>
      </span>
    </a>
  );
}
