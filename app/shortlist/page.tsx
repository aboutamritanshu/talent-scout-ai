"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { InterestAssessment, MatchResult, ShortlistEntry } from "@/lib/types";
import WorkflowProgress from "@/components/WorkflowProgress";

const SELECTED_MATCH_STORAGE_KEY = "talent-scout:selected-match";
const MATCH_RESULTS_STORAGE_KEY = "talent-scout:match-results";
const OUTREACH_PREFIX = "talent-scout:outreach:";

interface SelectedMatchState {
  matchResult: MatchResult;
}

interface StoredOutreachResult {
  transcript?: unknown;
  interestAssessment: InterestAssessment;
}

interface OutreachResultInput {
  candidateId: string;
  interestAssessment: InterestAssessment;
}

type SortKey = "combinedScore" | "matchScore" | "interestScore";

export default function ShortlistPage() {
  const [shortlist, setShortlist] = useState<ShortlistEntry[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("combinedScore");
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOutreach, setNeedsOutreach] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadShortlist() {
      setLoading(true);
      setError(null);
      setNeedsOutreach(false);

      let matches: MatchResult[] = [];
      let outreachResults: OutreachResultInput[] = [];

      try {
        const selectedRaw = localStorage.getItem(SELECTED_MATCH_STORAGE_KEY);
        const matchesRaw = localStorage.getItem(MATCH_RESULTS_STORAGE_KEY);
        if (matchesRaw) {
          matches = JSON.parse(matchesRaw) as MatchResult[];
        }
        if (selectedRaw) {
          const selected = JSON.parse(selectedRaw) as SelectedMatchState;
          if (selected.matchResult && matches.length === 0) {
            matches = [selected.matchResult];
          }
        }

        outreachResults = collectOutreachResults();
      } catch {
        setError("Could not read shortlist data from this browser.");
        setLoading(false);
        return;
      }

      if (matches.length === 0 || outreachResults.length === 0) {
        setNeedsOutreach(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/shortlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matches, outreachResults }),
        });

        const data: { shortlist?: ShortlistEntry[]; error?: string } =
          await res.json();
        if (!res.ok || !data.shortlist) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        if (data.shortlist.length === 0) {
          setNeedsOutreach(true);
          return;
        }

        if (!cancelled) setShortlist(data.shortlist);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unexpected error while building shortlist.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadShortlist();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedShortlist = useMemo(
    () => [...shortlist].sort((a, b) => b[sortKey] - a[sortKey]),
    [shortlist, sortKey],
  );

  const recruiterSummary = useMemo(
    () => buildRecruiterSummary(sortedShortlist),
    [sortedShortlist],
  );

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(sortedShortlist, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "talent-scout-shortlist.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const top = sortedShortlist[0];

  return (
    <div className="space-y-8">
      <WorkflowProgress currentStep={4} />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-slideup">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Step 4 of 4
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="text-gradient">Executive shortlist</span>
          </h1>
          <p className="max-w-2xl text-slate-400">
            Final ranked candidates using the existing Match Score and Interest
            Score. Combined Score is weighted 60% match and 40% interest.
          </p>
        </div>

        {!loading && !error && !needsOutreach && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Sort by
              </span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="rounded-md border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand-500"
              >
                <option value="combinedScore">Combined Score</option>
                <option value="matchScore">Match Score</option>
                <option value="interestScore">Interest Score</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleExport}
              className="btn-primary px-4 py-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export JSON
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/candidates" className="btn-secondary text-xs px-3 py-2">
          Back to Matches
        </Link>
      </div>

      {loading && <LoadingState />}

      {needsOutreach && !loading && <OutreachFallback />}

      {error && (
        <section className="rounded-lg border border-score-low/30 bg-score-low/10 p-5 text-sm text-score-low animate-fadein">
          <p className="font-medium">Could not build shortlist</p>
          <p className="mt-1 text-score-low/90">{error}</p>
          <Link
            href="/candidates"
            className="mt-4 inline-flex rounded-md border border-score-low/30 bg-score-low/10 px-3 py-2 text-sm font-medium text-score-low hover:bg-score-low/15"
          >
            Back to matches
          </Link>
        </section>
      )}

      {!loading && !error && !needsOutreach && (
        <>
          {top && <TopCandidateHero entry={top} />}

          <SummarySection summary={recruiterSummary} />

          <section className="card overflow-hidden animate-slideup" style={{ animationDelay: "120ms" }}>
            <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.7fr] gap-4 border-b border-surface-600 bg-surface-700 px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <span>Name</span>
              <span>Role</span>
              <span>Match</span>
              <span>Interest</span>
              <span>Combined</span>
            </div>

            <div className="divide-y divide-surface-600">
              {sortedShortlist.map((entry, index) => (
                <ShortlistRow
                  key={entry.candidate.id}
                  entry={entry}
                  rank={index + 1}
                  expanded={expandedCandidateId === entry.candidate.id}
                  onToggle={() =>
                    setExpandedCandidateId((current) =>
                      current === entry.candidate.id ? null : entry.candidate.id,
                    )
                  }
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 55) return "mid";
  return "low";
}

function TopCandidateHero({ entry }: { entry: ShortlistEntry }) {
  const initials = entry.candidate.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <section className="card border-l-2 border-l-brand-500 p-6 animate-slideup">
      <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
        <span className="flex h-14 w-14 items-center justify-center rounded-md border border-surface-600 bg-surface-700 font-mono text-lg font-semibold text-slate-100">
          {initials}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-brand-500/50 bg-brand-100 text-[10px] uppercase tracking-[0.14em] text-brand-700">
              Top of shortlist
            </span>
            <RecommendationBadge recommendation={entry.recommendation} />
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100 sm:text-[1.65rem]">
            {entry.candidate.name}
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {entry.candidate.title} / {entry.candidate.location}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <HeroScore label="Match" score={entry.matchScore} />
          <HeroScore label="Interest" score={entry.interestScore} />
          <HeroScore label="Combined" score={entry.combinedScore} primary />
        </div>
      </div>
    </section>
  );
}

function HeroScore({
  label,
  score,
  primary = false,
}: {
  label: string;
  score: number;
  primary?: boolean;
}) {
  const tone = scoreTone(score);
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-mono font-semibold tracking-tight tier-${tone} ${
          primary ? "text-3xl" : "text-2xl"
        }`}
      >
        {score}
      </p>
    </div>
  );
}

function buildRecruiterSummary(shortlist: ShortlistEntry[]) {
  const best = shortlist[0];
  const backup = shortlist[1];
  const biggestRisk =
    shortlist.find((entry) => entry.riskFlags.length > 0)?.riskFlags[0] ||
    "No major risks flagged";
  const nextAction = best
    ? best.recommendation === "Hire"
      ? `Schedule recruiter screen with ${best.candidate.name}.`
      : best.recommendation === "Consider"
        ? `Clarify risk areas with ${best.candidate.name} before next round.`
        : "Review candidate pool before moving forward."
    : "Complete outreach simulation first.";

  return {
    bestCandidate: best?.candidate.name || "Not available",
    backupCandidate: backup?.candidate.name || "Not available",
    biggestRisk,
    nextAction,
  };
}

function SummarySection({
  summary,
}: {
  summary: ReturnType<typeof buildRecruiterSummary>;
}) {
  const items = [
    { label: "Best candidate", value: summary.bestCandidate, accent: "border-l-score-high" },
    { label: "Backup candidate", value: summary.backupCandidate, accent: "border-l-brand-500" },
    { label: "Biggest risk", value: summary.biggestRisk, accent: "border-l-score-mid" },
    { label: "Recommended next action", value: summary.nextAction, accent: "border-l-accent-400" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`card card-hover border-l-2 ${item.accent} p-5 animate-slideup`}
          style={{ animationDelay: `${60 + i * 40}ms` }}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-100">
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}

function collectOutreachResults(): OutreachResultInput[] {
  const results: OutreachResultInput[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(OUTREACH_PREFIX)) continue;

    const raw = localStorage.getItem(key);
    if (!raw) continue;

    const parsed = JSON.parse(raw) as StoredOutreachResult;
    if (!parsed.interestAssessment) continue;

    results.push({
      candidateId: key.slice(OUTREACH_PREFIX.length),
      interestAssessment: parsed.interestAssessment,
    });
  }

  return results;
}

function LoadingState() {
  return (
    <section className="card p-6 animate-fadein">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span
          className="h-4 w-4 rounded-full border-2 border-brand-500/40 border-t-brand-500 animate-spin"
          aria-hidden
        />
        Building ranked shortlist...
      </div>
    </section>
  );
}

function OutreachFallback() {
  return (
    <section className="card p-8 animate-popin">
      <div className="flex flex-col items-start gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-100">
            Complete outreach simulation first
          </p>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            The final shortlist needs at least one completed outreach result so
            it can combine Match Score with Interest Score.
          </p>
        </div>
        <Link href="/candidates" className="btn-primary px-5 py-2.5">
          Back to matches
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

function ShortlistRow({
  entry,
  rank,
  expanded,
  onToggle,
}: {
  entry: ShortlistEntry;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.7fr] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-700"
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500">
            #{String(rank).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-slate-100">
                {entry.candidate.name}
              </p>
              <RecommendationBadge recommendation={entry.recommendation} />
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {entry.candidate.location}
            </p>
          </div>
        </div>
        <p className="min-w-0 truncate text-sm text-slate-300">
          {entry.candidate.title}
        </p>
        <ScoreCell score={entry.matchScore} />
        <ScoreCell score={entry.interestScore} />
        <ScoreCell score={entry.combinedScore} strong />
      </button>

      {expanded && (
        <div className="border-t border-surface-600 bg-surface-700 px-5 py-5 animate-slideup">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Ranking explanation
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {entry.explanation}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Risk flags
              </p>
              {entry.riskFlags.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  No major risks flagged.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.riskFlags.map((flag, index) => (
                    <span
                      key={`${flag}-${index}`}
                      className="chip border-score-mid/30 bg-score-mid/10 text-score-mid"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ScoreCell({ score, strong = false }: { score: number; strong?: boolean }) {
  const tone = scoreTone(score);
  return (
    <div>
      <p
        className={`font-mono text-sm tier-${tone} ${
          strong ? "font-semibold" : ""
        }`}
      >
        {score}
      </p>
      <div className={`mt-2 score-bar-track score-bar-${tone}`}>
        <div
          className="score-bar-fill"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationBadge({
  recommendation,
}: {
  recommendation: ShortlistEntry["recommendation"];
}) {
  const cls =
    recommendation === "Hire"
      ? "pill-hire"
      : recommendation === "Consider"
        ? "pill-consider"
        : "pill-reject";

  return <span className={cls}>{recommendation}</span>;
}
