import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talent Scout — AI Recruiter Agent",
  description:
    "An AI-powered talent scouting and engagement agent: parse a JD, match candidates, run simulated outreach, and produce an explainable ranked shortlist.",
};

const NAV_STEPS = [
  { href: "/jd-input", label: "Job Description" },
  { href: "/candidates", label: "Matches" },
  { href: "/shortlist", label: "Shortlist" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-100 font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-white/40 bg-white/65 backdrop-blur-xl shadow-soft">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-3 transition-opacity hover:opacity-90"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 font-semibold text-white">
                TS
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-semibold tracking-tight">Talent Scout</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  AI Recruiter Agent
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 text-sm md:flex">
              {NAV_STEPS.map((step) => (
                <Link
                  key={step.href}
                  href={step.href}
                  className="rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:bg-surface-700 hover:text-brand-600"
                >
                  {step.label}
                </Link>
              ))}
            </nav>

            <Link
              href="/jd-input"
              className="btn-primary px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
            >
              New Search
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10 animate-fadein">
          {children}
        </main>

        <footer className="mt-20 border-t border-surface-600">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row">
            <span>Talent Scout · Catalyst Hackathon build</span>
            <span className="text-slate-500">Built by Amritanshu Shukla</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
