import { scoreCandidate } from "../lib/scorer";
import type { Candidate, ParsedJD } from "../lib/types";
import * as fs from "fs";
const candidates = JSON.parse(fs.readFileSync(__dirname + "/../data/candidates.json","utf8")) as Candidate[];
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
  rawText: "Sample JD",
};
const results = candidates.map(c => scoreCandidate(c, jd)).sort((a,b)=>b.matchScore-a.matchScore);
console.log("RANKED:");
for (const r of results) console.log("  " + String(r.matchScore).padStart(3) + "  " + r.candidate.name + "  (" + r.candidate.title + ")");
console.log("\n--- TOP candidate full object ---");
console.log(JSON.stringify(results[0], null, 2));
