/**
 * Standalone "Powered by LLM Gateway" badge — no dependencies, copy it into any
 * app. (Apps already using `@llmgateway/elements` can `import { PoweredBy }`
 * from there instead.) Every render is a referral-tagged link back to LLM
 * Gateway, so each deployment becomes an impression.
 */
export function PoweredBy({ campaign = "powered-by" }: { campaign?: string }) {
  const href =
    "https://llmgateway.io/?" +
    new URLSearchParams({
      utm_source: "powered-by",
      utm_medium: "badge",
      utm_campaign: campaign,
      ref: "powered-by",
    }).toString();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by LLM Gateway"
      className="group inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 font-mono text-[0.78rem] text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1.5"
          y="1.5"
          width="13"
          height="13"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.55"
        />
        <path
          d="M5 8h6M8.4 5.4 11 8l-2.6 2.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        Powered by <span className="font-semibold text-ink">LLM Gateway</span>
      </span>
    </a>
  );
}
