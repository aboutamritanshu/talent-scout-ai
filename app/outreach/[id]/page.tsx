"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  InterestAssessment,
  MatchResult,
  OutreachMessage,
  ParsedJD,
  ScoreBreakdown,
} from "@/lib/types";
import WorkflowProgress from "@/components/WorkflowProgress";

const JD_STORAGE_KEY = "talent-scout:parsed-jd";
const SELECTED_MATCH_STORAGE_KEY = "talent-scout:selected-match";

interface SelectedMatchState {
  parsedJD: ParsedJD | null;
  matchResult: MatchResult;
}

interface OutreachResult {
  transcript: OutreachMessage[];
  interestAssessment: InterestAssessment;
  fallback?: boolean;
  fallbackReason?: string;
}

export default function OutreachPage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;
  const [selected, setSelected] = useState<SelectedMatchState | null>(null);
  const [outreach, setOutreach] = useState<OutreachResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runOutreach() {
      setLoading(true);
      setError(null);

      let parsedJD: ParsedJD | null = null;
      let selectedMatch: SelectedMatchState | null = null;

      try {
        const storedJD = localStorage.getItem(JD_STORAGE_KEY);
        const storedMatch = localStorage.getItem(SELECTED_MATCH_STORAGE_KEY);

        if (storedJD) parsedJD = JSON.parse(storedJD) as ParsedJD;
        if (storedMatch) {
          selectedMatch = JSON.parse(storedMatch) as SelectedMatchState;
        }
      } catch {
        setError("Could not read the selected candidate from this browser.");
        setLoading(false);
        return;
      }

      if (!selectedMatch?.matchResult) {
        setError("No selected match found. Please choose a candidate first.");
        setLoading(false);
        return;
      }

      if (selectedMatch.matchResult.candidate.id !== candidateId) {
        setError("The selected candidate does not match this outreach page.");
        setLoading(false);
        return;
      }

      const jd = selectedMatch.parsedJD ?? parsedJD;
      if (!jd) {
        setError("No parsed JD found. Please parse a JD before outreach.");
        setLoading(false);
        return;
      }

      setSelected({ parsedJD: jd, matchResult: selectedMatch.matchResult });

      const outreachKey = `talent-scout:outreach:${candidateId}`;
      try {
        const existing = localStorage.getItem(outreachKey);
        if (existing) {
          const parsed = JSON.parse(existing) as OutreachResult;
          if (!cancelled) {
            setOutreach(parsed);
            setLoading(false);
          }
          return;
        }
      } catch {
        // Ignore stale saved outreach and regenerate below.
      }

      try {
        const res = await fetch("/api/simulate-outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parsedJD: jd,
            matchResult: selectedMatch.matchResult,
          }),
        });

        const data: Partial<OutreachResult> & { error?: string } = await res.json();
        if (!res.ok || !data.transcript || !data.interestAssessment) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const result: OutreachResult = {
          transcript: data.transcript,
          interestAssessment: data.interestAssessment,
          fallback: data.fallback,
          fallbackReason: data.fallbackReason,
        };

        try {
          localStorage.setItem(outreachKey, JSON.stringify(result));
        } catch {
          // The UI can still render even if persistence fails.
        }

        if (!cancelled) setOutreach(result);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unexpected error while simulating outreach.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    runOutreach();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const candidate = selected?.matchResult.candidate;

  return (
    <div className="space-y-8">
      <WorkflowProgress currentStep={3} />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-slideup">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Step 3 of 4
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="text-gradient">Outreach conversation</span>
          </h1>
          <p className="max-w-2xl text-slate-400">
            A simulated recruiter–candidate exchange used to derive the
            candidate&apos;s Interest Score.
          </p>
        </div>
        {candidate && (
          <div className="card flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-surface-600 bg-surface-700 font-mono text-xs font-semibold text-slate-100">
              {candidate.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Candidate
              </p>
              <p className="mt-0.5 font-semibold text-slate-100">
                {candidate.name}
              </p>
              <p className="text-xs text-slate-400">{candidate.title}</p>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/candidates" className="btn-secondary text-xs px-3 py-2">
          Back to Matches
        </Link>
        <Link href="/shortlist" className="btn-secondary text-xs px-3 py-2">
          View Shortlist
        </Link>
      </div>

      {loading && <LoadingState />}

      {error && (
        <section className="rounded-lg border border-score-low/30 bg-score-low/10 p-5 text-sm text-score-low animate-fadein">
          <p className="font-medium">Could not simulate outreach</p>
          <p className="mt-1 text-score-low/90">{error}</p>
          <Link
            href="/candidates"
            className="mt-4 inline-flex rounded-md border border-score-low/30 bg-score-low/10 px-3 py-2 text-sm font-medium text-score-low hover:bg-score-low/15"
          >
            Back to matches
          </Link>
        </section>
      )}

      {!loading && !error && outreach && selected && (
        <>
          {outreach.fallback && (
            <div className="rounded-lg border border-score-mid/30 bg-score-mid/10 p-4 text-sm text-score-mid animate-fadein">
              <span className="font-medium">Demo-safe fallback: </span>
              {outreach.fallbackReason || "AI outreach unavailable"}.
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <TranscriptPanel
              transcript={outreach.transcript}
              candidate={selected.matchResult.candidate}
            />
            <AssessmentPanel assessment={outreach.interestAssessment} />
          </div>
        </>
      )}
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
        Simulating recruiter outreach...
      </div>
    </section>
  );
}

function TranscriptPanel({
  transcript,
  candidate,
}: {
  transcript: OutreachMessage[];
  candidate: { name: string; title: string };
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-surface-600 bg-surface-700 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-score-high" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Live transcript
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">
              Recruiter Agent / {candidate.name}
            </p>
          </div>
        </div>
        <span className="chip border-surface-600 bg-surface-700 text-slate-300">
          {transcript.length} messages
        </span>
      </div>

      <div className="space-y-4 p-5">
        {transcript.map((message, index) => (
          <MessageBubble
            key={`${message.timestamp}-${index}`}
            message={message}
            candidateName={candidate.name}
            delay={index * 70}
          />
        ))}
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  candidateName,
  delay,
}: {
  message: OutreachMessage;
  candidateName: string;
  delay: number;
}) {
  const isAgent = message.role === "agent";
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(message.timestamp)),
    [message.timestamp],
  );
  const initials = isAgent
    ? "TS"
    : candidateName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

  return (
    <div
      className={`flex items-end gap-3 ${isAgent ? "justify-end" : "justify-start"} animate-slideup`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {!isAgent && <Avatar tone="candidate" initials={initials} />}
      <div
        className={`max-w-[78%] sm:max-w-[80%] rounded-lg border px-4 py-3 ${
          isAgent
            ? "border-brand-500/40 bg-brand-100 text-slate-100 rounded-br-sm"
            : "border-surface-600 bg-surface-700 text-slate-100 rounded-bl-sm"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAgent ? "Recruiter agent" : candidateName}
          </span>
          <span className="text-[10px] text-slate-500">{time}</span>
        </div>
        <p className="text-sm leading-relaxed break-words">{message.content}</p>
      </div>
      {isAgent && <Avatar tone="agent" initials={initials} />}
    </div>
  );
}

function Avatar({ tone, initials }: { tone: "agent" | "candidate"; initials: string }) {
  const cls =
    tone === "agent"
      ? "bg-brand-500 text-white"
      : "bg-surface-700 border border-surface-500 text-slate-200";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-mono font-semibold ${cls}`}
    >
      {initials}
    </span>
  );
}

function AssessmentPanel({ assessment }: { assessment: InterestAssessment }) {
  const personalityClass =
    assessment.personality === "interested"
      ? "pill-hire"
      : assessment.personality === "neutral"
        ? "pill-consider"
        : "pill-reject";

  const tone = scoreTone(assessment.interestScore);

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start animate-slideup" style={{ animationDelay: "100ms" }}>
      <section className="rounded-md border border-surface-600 bg-surface-800 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Interest Score
          </p>
          <span className={`${personalityClass} text-[10px] uppercase tracking-wider`}>
            {assessment.personality}
          </span>
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className={`font-mono text-5xl font-semibold tracking-tight tier-${tone}`}>
            {assessment.interestScore}
          </span>
          <span className="pb-1.5 text-sm text-slate-500">/ 100</span>
        </div>
        <div className={`mt-3 score-bar-track score-bar-${tone}`}>
          <div
            className="score-bar-fill"
            style={{ width: `${assessment.interestScore}%` }}
          />
        </div>
      </section>

      <section className="card p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Score breakdown
        </p>
        <div className="mt-4 space-y-4">
          {assessment.breakdown.map((row, i) => (
            <ScoreRow key={row.label} row={row} delay={i * 80} />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Recommendation
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          {assessment.recommendation}
        </p>
      </section>

      <section className="card p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Risk flags
        </p>
        {assessment.riskFlags.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No major risks flagged.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {assessment.riskFlags.map((flag, index) => (
              <span key={`${flag}-${index}`} className="pill-consider">
                {flag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Assessment
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {assessment.explanation}
        </p>
      </section>

      <Link href="/shortlist" className="btn-primary w-full px-4 py-3">
        Add to Shortlist
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </aside>
  );
}

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 55) return "mid";
  return "low";
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
