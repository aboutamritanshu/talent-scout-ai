"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { MatchResult, ParsedJD, ScoreBreakdown } from "@/lib/types";
import WorkflowProgress from "@/components/WorkflowProgress";

const JD_STORAGE_KEY = "talent-scout:parsed-jd";
const SELECTED_MATCH_STORAGE_KEY = "talent-scout:selected-match";
const MATCH_RESULTS_STORAGE_KEY = "talent-scout:match-results";

export default function CandidatesPage() {
  const router = useRouter();
  const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasStoredJD, setHasStoredJD] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      setLoading(true);
      setError(null);

      let stored: string | null = null;
      try {
        stored = localStorage.getItem(JD_STORAGE_KEY);
      } catch {
        setError("Could not read the parsed JD from this browser.");
        setLoading(false);
        return;
      }

      if (!stored) {
        setHasStoredJD(false);
        setLoading(false);
        return;
      }

      let jd: ParsedJD;
      try {
        jd = JSON.parse(stored) as ParsedJD;
      } catch {
        setHasStoredJD(false);
        setError("The saved parsed JD is invalid. Please parse the JD again.");
        setLoading(false);
        return;
      }

      setParsedJD(jd);

      try {
        const res = await fetch("/api/match-candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsedJD: jd }),
        });

        const data: { results?: MatchResult[]; error?: string } = await res.json();
        if (!res.ok || !data.results) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        try {
          localStorage.setItem(
            MATCH_RESULTS_STORAGE_KEY,
            JSON.stringify(data.results),
          );
        } catch {
          // The page can still render even if persistence fails.
        }

        if (!cancelled) setResults(data.results);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unexpected error while matching candidates.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMatches();
    return () => {
      cancelled = true;
    };
  }, []);

  const topScore = useMemo(
    () => results.reduce((max, result) => Math.max(max, result.matchScore), 0),
    [results],
  );

  const handleSimulateOutreach = (result: MatchResult) => {
    try {
      localStorage.setItem(
        SELECTED_MATCH_STORAGE_KEY,
        JSON.stringify({ parsedJD, matchResult: result }),
      );
    } catch {
      // Navigation can continue; the outreach page can fall back to route id later.
    }
    router.push(`/outreach/${result.candidate.id}`);
  };

  if (!hasStoredJD) {
    return <NoParsedJDFallback />;
  }

  return (
    <div className="space-y-8">
      <WorkflowProgress currentStep={2} />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-slideup">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Step 2 of 4
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="text-gradient">Matches</span>
          </h1>
          <p className="max-w-2xl text-slate-400">
            Candidates scored against the parsed JD, each with an explainable
            breakdown across skills, experience, domain, and education.
          </p>
        </div>
        {parsedJD && (
          <div className="card px-5 py-4 text-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Current role
            </p>
            <p className="mt-1 font-semibold text-slate-100">
              {parsedJD.jobTitle || "Untitled role"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {[parsedJD.seniorityLevel, parsedJD.domain, parsedJD.location]
                .filter(Boolean)
                .join(" / ") || "Parsed JD saved"}
            </p>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/jd-input" className="btn-secondary text-xs px-3 py-2">
          Back to JD Input
        </Link>
        <Link href="/shortlist" className="btn-secondary text-xs px-3 py-2">
          View Shortlist
        </Link>
      </div>

      {loading && <LoadingState />}

      {error && (
        <section className="rounded-lg border border-score-low/30 bg-score-low/10 p-5 text-sm text-score-low animate-fadein">
          <p className="font-medium">Could not match candidates</p>
          <p className="mt-1 text-score-low/90">{error}</p>
          <Link
            href="/jd-input"
            className="mt-4 inline-flex rounded-md border border-score-low/30 bg-score-low/10 px-3 py-2 text-sm font-medium text-score-low hover:bg-score-low/15"
          >
            Parse a JD again
          </Link>
        </section>
      )}

      {!loading && !error && results.length === 0 && (
        <section className="card p-6">
          <p className="text-lg font-semibold text-slate-100">
            No candidates matched this JD
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Try parsing a broader JD or review the extracted skills.
          </p>
        </section>
      )}

      {!loading && !error && results.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-300">
              Ranked{" "}
              <span className="font-mono text-slate-100">{results.length}</span>{" "}
              candidates by Match Score.
            </p>
            <p className="text-xs text-slate-500">
              Top score:{" "}
              <span className="font-mono text-brand-600">
                {topScore || "-"}
              </span>{" "}
              / 100
            </p>
          </div>

          {results.map((result, index) => (
            <CandidateCard
              key={result.candidate.id}
              rank={index + 1}
              result={result}
              onSimulateOutreach={handleSimulateOutreach}
              animationDelay={index * 60}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function NoParsedJDFallback() {
  return (
    <div className="space-y-6">
      <WorkflowProgress currentStep={2} />
      <header className="space-y-3 animate-slideup">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Step 2 of 4
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-gradient">Matches</span>
        </h1>
      </header>
      <section className="card p-8 animate-popin">
        <div className="flex flex-col items-start gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-100">
              Please parse a JD first
            </p>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Candidate matching needs the structured job description saved from
              Step 1.
            </p>
          </div>
          <Link href="/jd-input" className="btn-primary px-5 py-2.5">
            Go to JD input
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="card p-6 animate-fadein">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span
          className="h-4 w-4 rounded-full border-2 border-brand-500/40 border-t-brand-500 animate-spin"
          aria-hidden
        />
        Scoring candidates against the parsed JD...
      </div>
    </section>
  );
}

function CandidateCard({
  rank,
  result,
  onSimulateOutreach,
  animationDelay,
}: {
  rank: number;
  result: MatchResult;
  onSimulateOutreach: (result: MatchResult) => void;
  animationDelay: number;
}) {
  const { candidate } = result;
  const initials = candidate.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const tier =
    result.matchScore >= 75
      ? { label: "Strong fit", style: "pill-hire" }
      : result.matchScore >= 55
        ? { label: "Possible fit", style: "pill-consider" }
        : { label: "Weak fit", style: "chip border-surface-500 bg-surface-700 text-slate-300" };

  return (
    <article
      className="card card-hover p-6 animate-slideup"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-surface-600 bg-surface-700 font-mono text-sm font-semibold text-slate-100">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-brand-400">#{rank}</span>
                <h2 className="text-xl font-semibold tracking-tight text-slate-100">
                  {candidate.name}
                </h2>
                <span className={tier.style}>{tier.label}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{candidate.title}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{candidate.location}</span>
                <span>{candidate.experienceYears} years experience</span>
                <span>available in {candidate.availableIn} weeks</span>
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            {candidate.summary}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <SkillList
              label="Matched skills"
              items={result.matchedSkills}
              emptyLabel="No required skills matched"
              tone="positive"
            />
            <SkillList
              label="Missing skills / gaps"
              items={
                result.missingSkills.length > 0
                  ? result.missingSkills
                  : result.gaps
              }
              emptyLabel="No major gaps flagged"
              tone="warning"
            />
          </div>

          <div className="rounded-md border border-surface-600 bg-surface-700 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Why this score
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {result.explanation}
            </p>
          </div>
        </div>

        <aside className="w-full space-y-4 lg:w-80">
          <ScoreBadge score={result.matchScore} />
          <div className="space-y-3 rounded-md border border-surface-600 bg-surface-700 p-4">
            {result.breakdown.map((row, i) => (
              <ScoreRow key={row.label} row={row} delay={i * 80} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSimulateOutreach(result)}
            className="btn-primary w-full px-4 py-3"
          >
            Simulate Outreach
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </button>
        </aside>
      </div>
    </article>
  );
}

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 55) return "mid";
  return "low";
}

function ScoreBadge({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="rounded-md border border-surface-600 bg-surface-800 p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        Match Score
      </p>
      <div className="mt-2 flex items-end gap-2">
        <span className={`font-mono text-5xl font-semibold tracking-tight tier-${tone}`}>
          {score}
        </span>
        <span className="pb-1.5 text-sm text-slate-500">/ 100</span>
      </div>
      <div className={`mt-3 score-bar-track score-bar-${tone}`}>
        <div
          className="score-bar-fill"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

function ScoreRow({ row, delay }: { row: ScoreBreakdown; delay: number }) {
  const tone = scoreTone(row.score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-200">
          {row.label}
          <span className="ml-1 text-slate-500">
            {Math.round(row.weight * 100)}%
          </span>
        </span>
        <span className={`font-mono tier-${tone}`}>{row.score}</span>
      </div>
      <div className={`score-bar-track score-bar-${tone}`}>
        <div
          className="score-bar-fill"
          style={{
            width: `${Math.max(0, Math.min(100, row.score))}%`,
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{row.note}</p>
    </div>
  );
}

function SkillList({
  label,
  items,
  emptyLabel,
  tone,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
  tone: "positive" | "warning";
}) {
  const pillClass = tone === "positive" ? "pill-hire" : "pill-consider";

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span key={`${item}-${index}`} className={pillClass}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
