"use client";

import { useState } from "react";
import Link from "next/link";
import type { ParsedJD } from "@/lib/types";
import WorkflowProgress from "@/components/WorkflowProgress";

const SAMPLE_JD = `We are hiring a Senior React Developer with 4+ years experience in React, TypeScript, Node.js. Must have experience with REST APIs and cloud platforms (AWS preferred). Competitive salary 18-25 LPA. Remote-friendly.`;

const STORAGE_KEY = "talent-scout:parsed-jd";

export default function JdInputPage() {
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedJD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const handleSample = () => {
    setJdText(SAMPLE_JD);
    setError(null);
    setFallbackNotice(null);
  };

  const handleClear = () => {
    setJdText("");
    setParsed(null);
    setError(null);
    setFallbackNotice(null);
  };

  const handleParse = async () => {
    setError(null);
    setParsed(null);
    setFallbackNotice(null);

    const text = jdText.trim();
    if (text.length < 50) {
      setError("Please paste a job description of at least 50 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/parse-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: text }),
      });

      const data: {
        parsed?: ParsedJD;
        error?: string;
        fallback?: boolean;
        fallbackReason?: string;
      } = await res.json();

      if (!res.ok || !data.parsed) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setParsed(data.parsed);
      if (data.fallback) {
        setFallbackNotice(
          `Demo-safe parser fallback used: ${data.fallbackReason || "AI parser unavailable"}.`,
        );
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.parsed));
      } catch {
        // Ignore storage failures (private browsing, quota, etc.).
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error parsing the JD.");
    } finally {
      setLoading(false);
    }
  };

  const charCount = jdText.length;
  const canSubmit = charCount >= 50 && !loading;

  return (
    <div className="space-y-8">
      <WorkflowProgress currentStep={1} />

      <header className="space-y-3 animate-slideup">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Step 1 of 4
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-gradient">Job description</span>
        </h1>
        <p className="max-w-2xl text-slate-400">
          Paste a job description below. The agent will extract the role,
          required skills, seniority, salary band, and other constraints, then
          use them to match and rank candidates.
        </p>
      </header>

      <section className="card p-6 space-y-5 animate-slideup" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label htmlFor="jd" className="text-sm font-medium text-slate-200">
            Paste the JD
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSample}
              className="btn-ghost border border-surface-600"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 4h6v6" />
                <path d="M10 20H4v-6" />
                <path d="M20 4 14 10" />
                <path d="M4 20l6-6" />
              </svg>
              Use Sample JD
            </button>
            {jdText && (
              <button
                type="button"
                onClick={handleClear}
                className="btn-ghost"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            id="jd"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="e.g., We are hiring a Senior React Developer with 4+ years of experience..."
            rows={10}
            className="w-full resize-y rounded-lg border border-surface-600 bg-surface-800 p-4 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 transition-colors duration-200 focus:border-brand-500 focus:bg-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-slate-500">
            <span className="font-mono text-slate-300">{charCount}</span>{" "}
            characters{" "}
            {charCount > 0 && charCount < 50 && (
              <span className="text-score-mid">
                needs at least 50 to parse
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={handleParse}
            disabled={!canSubmit}
            className="btn-primary px-5 py-2.5"
          >
            {loading && <Spinner />}
            {loading ? "Parsing..." : "Parse & Find Candidates"}
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-score-low/30 bg-score-low/10 p-4 text-sm text-score-low animate-fadein">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 text-score-low/90">{error}</p>
          </div>
        )}
      </section>

      {parsed && <ParsedSummary parsed={parsed} />}

      {fallbackNotice && (
        <div className="rounded-lg border border-score-mid/30 bg-score-mid/10 p-4 text-sm text-score-mid animate-fadein">
          <span className="font-medium">Heads up: </span>
          {fallbackNotice}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin"
      aria-hidden
    />
  );
}

function ParsedSummary({ parsed }: { parsed: ParsedJD }) {
  return (
    <section className="card p-6 space-y-6 animate-popin">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Parsed job description
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {parsed.jobTitle || "Untitled role"}
          </h2>
          <p className="text-sm text-slate-400">
            {[parsed.seniorityLevel, parsed.domain, parsed.location]
              .filter(Boolean)
              .join(" / ") || "Details pending"}
          </p>
        </div>
        <Link href="/candidates" className="btn-primary px-5 py-2.5">
          View Matching Candidates
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </header>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Min. experience">
          <span className="font-mono text-lg font-semibold text-slate-100">
            {parsed.experienceYearsRequired > 0
              ? `${parsed.experienceYearsRequired}+ yrs`
              : "Any"}
          </span>
        </Field>
        <Field label="Salary range">
          <span className="text-base font-medium text-slate-100">
            {parsed.salaryRange || "Not specified"}
          </span>
        </Field>
        <Field label="Location">
          <span className="text-base font-medium text-slate-100">
            {parsed.location || "Not specified"}
          </span>
        </Field>
        <Field label="Education">
          <span className="text-base font-medium text-slate-100">
            {parsed.educationRequirement || "Not specified"}
          </span>
        </Field>
      </div>

      <Field label="Required skills">
        <ChipRow items={parsed.requiredSkills} tone="required" emptyLabel="None listed" />
      </Field>

      <Field label="Nice-to-have skills">
        <ChipRow items={parsed.niceToHaveSkills} tone="optional" emptyLabel="None listed" />
      </Field>

      {parsed.responsibilities.length > 0 && (
        <Field label="Core responsibilities">
          <ul className="grid gap-1.5 text-sm text-slate-200 sm:grid-cols-2">
            {parsed.responsibilities.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Field>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ChipRow({
  items,
  tone,
  emptyLabel,
}: {
  items: string[];
  tone: "required" | "optional";
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }
  const styles =
    tone === "required"
      ? "border-brand-500/40 bg-brand-100 text-brand-700"
      : "border-surface-600 bg-surface-700 text-slate-200";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className={`chip ${styles}`}>
          {item}
        </span>
      ))}
    </div>
  );
}
