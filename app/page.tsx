import Link from "next/link";
import ScrollHeadline from "@/components/ScrollHeadline";

const PIPELINE = [
  {
    step: "01",
    title: "Parse the job description",
    body: "Drop in a JD and the agent extracts skills, seniority, domain, education, salary band, and start-date constraints.",
  },
  {
    step: "02",
    title: "Match candidates with explainable scores",
    body: "Every candidate is scored on skills, experience, domain, and education — with a plain-English reason for each score.",
  },
  {
    step: "03",
    title: "Simulate outreach conversations",
    body: "A recruiter-style agent engages the top matches, asks targeted questions, and derives an Interest Score from the replies.",
  },
  {
    step: "04",
    title: "Produce a ranked, explainable shortlist",
    body: "Match and Interest combine into a single ranked view. Every score links back to the evidence behind it.",
  },
];

const CAPABILITIES = [
  { label: "Candidates seeded", value: "15" },
  { label: "Score categories", value: "4 + 4" },
  { label: "Avg. parse time", value: "< 2s" },
];

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-7 animate-slideup">
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-600 bg-surface-800 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            AI Recruiter Agent
          </span>

          <ScrollHeadline className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Find, qualify, and shortlist
            <br />
            with every score explained.
          </ScrollHeadline>

          <p className="max-w-xl text-lg leading-relaxed text-slate-400">
            Talent Scout turns a job description into a ranked shortlist. It
            parses the JD, scores matches, runs simulated outreach to gauge real
            interest, and shows you the reasoning behind every number.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/jd-input" className="btn-primary px-5 py-3 text-sm">
              Start New Search
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link href="/candidates" className="btn-secondary px-5 py-3 text-sm">
              View Matches
            </Link>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-surface-600 pt-6 max-w-md">
            {CAPABILITIES.map((cap) => (
              <div key={cap.label}>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {cap.label}
                </dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-slate-100">
                  {cap.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative animate-slideup" style={{ animationDelay: "120ms" }}>
          <div className="card overflow-hidden p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Today at a glance
              </p>
              <span className="pill-hire text-[10px] uppercase tracking-wider">
                Live demo
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-5">
              <PreviewStat label="Candidates" value="15" />
              <PreviewStat label="Avg. match" value="—" />
              <PreviewStat label="Shortlist" value="—" />
            </div>

            <div className="mt-6 space-y-3">
              {[82, 68, 47].map((score, i) => {
                const tone = score >= 75 ? "high" : score >= 55 ? "mid" : "low";
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{["Top match", "Median match", "Floor match"][i]}</span>
                      <span className={`font-mono tier-${tone}`}>{score}</span>
                    </div>
                    <div className={`score-bar-track score-bar-${tone}`}>
                      <div
                        className="score-bar-fill"
                        style={{ width: `${score}%`, animationDelay: `${150 + i * 90}ms` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-md border border-surface-600 bg-surface-700 p-4 text-sm text-slate-300">
              Kick off a search from the{" "}
              <Link
                href="/jd-input"
                className="font-medium text-brand-400 underline decoration-surface-500 underline-offset-2 hover:decoration-brand-500"
              >
                Job Description
              </Link>{" "}
              step. The agent will do the rest.
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">
            How the agent works
          </h2>
          <span className="text-xs text-slate-500">4 explainable stages</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PIPELINE.map((stage, i) => (
            <div
              key={stage.step}
              className="card card-hover p-6 animate-slideup"
              style={{ animationDelay: `${100 + i * 70}ms` }}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-surface-600 bg-surface-700 font-mono text-xs text-brand-600">
                  {stage.step}
                </span>
                <div>
                  <h3 className="font-semibold tracking-tight text-slate-100">
                    {stage.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {stage.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-semibold tracking-tight text-slate-100">
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
    </div>
  );
}
