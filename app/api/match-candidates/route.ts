import { NextResponse } from "next/server";
import candidates from "@/data/candidates.json";
import { scoreCandidate } from "@/lib/scorer";
import type { Candidate, ParsedJD } from "@/lib/types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isParsedJD(value: unknown): value is ParsedJD {
  if (!value || typeof value !== "object") return false;

  const jd = value as Record<string, unknown>;
  return (
    typeof jd.jobTitle === "string" &&
    isStringArray(jd.requiredSkills) &&
    isStringArray(jd.niceToHaveSkills) &&
    typeof jd.experienceYearsRequired === "number" &&
    Number.isFinite(jd.experienceYearsRequired) &&
    typeof jd.domain === "string" &&
    typeof jd.educationRequirement === "string" &&
    typeof jd.salaryRange === "string" &&
    typeof jd.location === "string" &&
    isStringArray(jd.responsibilities) &&
    typeof jd.seniorityLevel === "string" &&
    typeof jd.rawText === "string"
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsedJD =
    body && typeof body === "object" && "parsedJD" in body
      ? (body as { parsedJD: unknown }).parsedJD
      : undefined;

  if (!isParsedJD(parsedJD)) {
    return NextResponse.json(
      { error: "Field 'parsedJD' is required and must match ParsedJD." },
      { status: 400 },
    );
  }

  const results = (candidates as Candidate[])
    .map((candidate) => scoreCandidate(candidate, parsedJD))
    .sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json({ results }, { status: 200 });
}
