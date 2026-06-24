"use client";

import { useMemo, useState } from "react";
import { PoweredBy } from "@/components/powered-by";
import {
  ALL_TAGS,
  SHOWCASE,
  SUBMIT_URL,
  type ShowcaseEntry,
} from "@/lib/showcase";

type TypeFilter = "all" | "official" | "community";

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "official", label: "Official" },
  { key: "community", label: "Community" },
];

export default function Page() {
  const [tag, setTag] = useState<string | null>(null);
  const [type, setType] = useState<TypeFilter>("all");

  const entries = useMemo(
    () =>
      SHOWCASE.filter(
        (e) =>
          (type === "all" || e.type === type) &&
          (tag === null || e.tags.includes(tag)),
      ),
    [tag, type],
  );

  const templateCount = new Set(SHOWCASE.map((e) => e.template)).size;

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8">
      <Masthead total={SHOWCASE.length} templates={templateCount} />
      <Ticker total={SHOWCASE.length} templates={templateCount} />
      <Toolbar
        tag={tag}
        type={type}
        onTag={setTag}
        onType={setType}
        count={entries.length}
      />
      <Index entries={entries} />
      <Footer />
    </div>
  );
}

function Masthead({ total, templates }: { total: number; templates: number }) {
  return (
    <header className="pt-12 sm:pt-16">
      <div className="flex items-center justify-between font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-soft">
        <span>LLM Gateway — Showcase</span>
        <span className="tabular">
          {String(total).padStart(2, "0")} apps · {templates} templates
        </span>
      </div>
      <hr className="rule mt-3" />

      <h1 className="mt-8 font-display text-[clamp(2.75rem,9vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
        Built with{" "}
        <span className="text-accent">
          LLM&nbsp;Gateway
          <span className="italic">.</span>
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">
        A directory of real apps shipped on{" "}
        <a
          href="https://llmgateway.io/?utm_source=showcase&utm_medium=lede&utm_campaign=showcase"
          target="_blank"
          rel="noreferrer"
          className="text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
        >
          LLM Gateway
        </a>{" "}
        templates — one key, a hundred models. Browse it, fork it, then add your
        own.
      </p>
    </header>
  );
}

function Ticker({ total, templates }: { total: number; templates: number }) {
  const items = [
    `${total} apps`,
    `${templates} templates`,
    "100+ models",
    "one API key",
    "deploy in minutes",
    "open source",
  ];
  const line = (
    <>
      {items.map((t, i) => (
        <span key={i} className="font-mono text-[0.8rem] uppercase tracking-wide">
          {t} <span className="text-accent">✦</span>
        </span>
      ))}
    </>
  );
  return (
    <div className="marquee mt-12">
      <div className="marquee__track">
        {line}
        {line}
      </div>
    </div>
  );
}

function Toolbar({
  tag,
  type,
  onTag,
  onType,
  count,
}: {
  tag: string | null;
  type: TypeFilter;
  onTag: (t: string | null) => void;
  onType: (t: TypeFilter) => void;
  count: number;
}) {
  return (
    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            className="chip"
            data-active={type === f.key}
            onClick={() => onType(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line-strong" aria-hidden="true" />
        <button
          className="chip"
          data-active={tag === null}
          onClick={() => onTag(null)}
        >
          all tags
        </button>
        {ALL_TAGS.map((t) => (
          <button
            key={t}
            className="chip"
            data-active={tag === t}
            onClick={() => onTag(tag === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>
      <span className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        {count} shown
      </span>
    </div>
  );
}

function Index({ entries }: { entries: ShowcaseEntry[] }) {
  return (
    <section className="mt-6">
      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        entries.map((e, i) => <Entry key={e.slug} entry={e} index={i} />)
      )}
      <SubmitRow />
    </section>
  );
}

function Entry({ entry, index }: { entry: ShowcaseEntry; index: number }) {
  return (
    <a
      className="entry reveal"
      href={entry.url}
      target="_blank"
      rel="noreferrer"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <span className="entry__index tabular">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div>
        <h2 className="entry__name">{entry.name}</h2>
        <p className="mt-2 max-w-xl text-[0.98rem] leading-relaxed text-ink-soft">
          {entry.tagline}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[0.72rem] text-ink-faint">
          <span className="text-ink-soft">
            {entry.type === "official" ? "★ official" : "by " + entry.author}
          </span>
          <span aria-hidden="true">·</span>
          <span>template: {entry.template}</span>
          <span aria-hidden="true">·</span>
          <span>{entry.tags.join(" / ")}</span>
        </div>
      </div>

      <span className="entry__visit">
        Visit <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="border-t border-line py-16 text-center">
      <p className="font-display text-3xl">No apps here yet.</p>
      <p className="mx-auto mt-3 max-w-md text-ink-soft">
        Be the first community app in this category — it takes one pull request.
      </p>
      <a
        href={SUBMIT_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-transform hover:-translate-y-0.5"
      >
        Submit your app →
      </a>
    </div>
  );
}

function SubmitRow() {
  return (
    <a
      href={SUBMIT_URL}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-4 border-t border-dashed border-line-strong py-8 transition-colors hover:bg-paper-2"
    >
      <div className="flex items-center gap-6">
        <span className="entry__index tabular pt-0 font-mono text-ink-faint">
          ++
        </span>
        <div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.25rem)] leading-none">
            Add your app
          </h2>
          <p className="mt-2 text-[0.95rem] text-ink-soft">
            Shipped something on a template? Get it listed here.
          </p>
        </div>
      </div>
      <span className="entry__visit text-accent">
        Submit <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pb-14">
      <hr className="rule" />
      <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="max-w-md font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
          Open source · MIT · fork the gallery, host your own
        </p>
        <PoweredBy campaign="showcase" />
      </div>
    </footer>
  );
}
