import { scoreCandidate } from "./lib/scorer";
import type { Candidate, ParsedJD } from "./lib/types";
import candidates from "./data/candidates.json";

const jd: ParsedJD = {
  jobTitle: "Senior React Developer",
  requiredSkills: ["React", "TypeScript", "Node.js", "REST APIs"],
  niceToHaveSkills: ["AWS", "Cloud platforms"],
  experienceYearsRequired: 4,
  domain: "",
  educationRequirement: "",
  salaryRange: "18-25 LPA",
  location: "Remote-friendly",
  responsibilities: [],
  seniorityLevel: "Senior",
  rawText: "Sample",
};

const results = (candidates as Candidate[])
  .map((c) => scoreCandidate(c, jd))
  .sort((a, b) => b.matchScore - a.matchScore);

console.log("\nRANKED MATCHES\n" + "=".repeat(60));
for (const r of results) {
  console.log(`${r.matchScore}  ${r.candidate.name} (${r.candidate.title})`);
  for (const row of r.breakdown) {
    console.log(`    ${row.label.padEnd(14)} ${String(row.score).padStart(3)} — ${row.note}`);
  }
}

console.log("\nFULL TOP CANDIDATE JSON:\n" + "=".repeat(60));
console.log(JSON.stringify(results[0], null, 2));
