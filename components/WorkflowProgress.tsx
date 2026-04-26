"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SELECTED_MATCH_KEY = "talent-scout:selected-match";

interface Step {
  href: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export default function WorkflowProgress({ currentStep }: { currentStep: number }) {
  const [outreachHref, setOutreachHref] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTED_MATCH_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        matchResult?: { candidate?: { id?: string } };
      };
      const id = parsed?.matchResult?.candidate?.id;
      if (typeof id === "string" && id.length > 0) {
        setOutreachHref(`/outreach/${id}`);
      }
    } catch {
      // localStorage unavailable or malformed — outreach stays disabled.
    }
  }, []);

  const steps: Step[] = [
    { href: "/jd-input", label: "JD Input" },
    { href: "/candidates", label: "Matches" },
    {
      href: outreachHref ?? "/candidates",
      label: "Outreach",
      hint: outreachHref ? undefined : "Pick a candidate first",
      disabled: !outreachHref,
    },
    { href: "/shortlist", label: "Shortlist" },
  ];

  return (
    <nav
      aria-label="Recruiting workflow progress"
      className="rounded-lg border border-surface-600 bg-surface-800 p-2 shadow-soft"
    >
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const active = stepNumber === currentStep;
          const complete = stepNumber < currentStep;

          const stateClass = active
            ? "border-brand-500/60 bg-brand-100 text-brand-700 shadow-[0_2px_8px_rgba(37,99,235,0.18)]"
            : complete
              ? "border-score-high/30 bg-score-high/10 text-score-high"
              : "border-surface-600 bg-surface-800 text-slate-400 hover:border-surface-500 hover:text-slate-100";

          const numberClass = active
            ? "bg-brand-500 text-white"
            : complete
              ? "bg-score-high/15 text-score-high"
              : "bg-surface-700 text-slate-400";

          const inner = (
            <span
              className={`flex h-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors duration-200 ${stateClass} ${
                step.disabled ? "cursor-not-allowed opacity-70" : ""
              }`}
              title={step.hint}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-mono font-semibold transition-colors ${numberClass}`}
              >
                {complete ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {step.label}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              )}
            </span>
          );

          if (step.disabled) {
            return (
              <li key={step.label} className="contents">
                <span aria-disabled className="block">
                  {inner}
                </span>
              </li>
            );
          }

          return (
            <li key={step.label} className="contents">
              <Link href={step.href} className="block">
                {inner}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
