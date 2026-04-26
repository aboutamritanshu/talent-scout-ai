import { NextResponse } from "next/server";
import type {
  InterestAssessment,
  MatchResult,
  ShortlistEntry,
} from "@/lib/types";

interface OutreachResultInput {
  candidateId: string;
  interestAssessment: InterestAssessment;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isInterestAssessment(value: unknown): value is InterestAssessment {
  if (!value || typeof value !== "object") return false;
  const assessment = value as Record<string, unknown>;
  return (
    typeof assessment.interestScore === "number" &&
    Number.isFinite(assessment.interestScore) &&
    Array.isArray(assessment.breakdown) &&
    typeof assessment.explanation === "string" &&
    typeof assessment.recommendation === "string" &&
    isStringArray(assessment.riskFlags) &&
    (assessment.personality === "interested" ||
      assessment.personality === "neutral" ||
      assessment.personality === "unavailable")
  );
}

function isMatchResult(value: unknown): value is MatchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const candidate = result.candidate as Record<string, unknown> | undefined;
  if (!candidate) return false;

  return (
    typeof result.matchScore === "number" &&
    Number.isFinite(result.matchScore) &&
    Array.isArray(result.breakdown) &&
    isStringArray(result.strengths) &&
    isStringArray(result.gaps) &&
    isStringArray(result.matchedSkills) &&
    isStringArray(result.missingSkills) &&
    typeof result.explanation === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.title === "string" &&
    isStringArray(candidate.skills) &&
    typeof candidate.experienceYears === "number" &&
    typeof candidate.domain === "string" &&
    typeof candidate.education === "string" &&
    typeof candidate.location === "string" &&
    typeof candidate.currentSalary === "number" &&
    typeof candidate.expectedSalary === "number" &&
    typeof candidate.availableIn === "number" &&
    typeof candidate.summary === "string"
  );
}

function isOutreachResultInput(value: unknown): value is OutreachResultInput {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.candidateId === "string" &&
    isInterestAssessment(result.interestAssessment)
  );
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recommendationFor(combinedScore: number): "Hire" | "Consider" | "Reject" {
  if (combinedScore >= 75) return "Hire";
  if (combinedScore >= 55) return "Consider";
  return "Reject";
}

function buildExplanation(
  match: MatchResult,
  assessment: InterestAssessment,
  combinedScore: number,
): string {
  return `${match.candidate.name} ranks here with a ${match.matchScore}/100 Match Score and ${assessment.interestScore}/100 Interest Score, producing a ${combinedScore}/100 Combined Score using the required 60/40 weighting. ${match.explanation} ${assessment.explanation}`;
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

  const matches =
    body && typeof body === "object" && "matches" in body
      ? (body as { matches: unknown }).matches
      : undefined;
  const outreachResults =
    body && typeof body === "object" && "outreachResults" in body
      ? (body as { outreachResults: unknown }).outreachResults
      : undefined;

  if (!Array.isArray(matches) || !matches.every(isMatchResult)) {
    return NextResponse.json(
      { error: "Field 'matches' is required and must be MatchResult[]." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(outreachResults) ||
    !outreachResults.every(isOutreachResultInput)
  ) {
    return NextResponse.json(
      {
        error:
          "Field 'outreachResults' is required and must include candidateId and interestAssessment.",
      },
      { status: 400 },
    );
  }

  const interestByCandidate = new Map(
    outreachResults.map((result) => [
      result.candidateId,
      result.interestAssessment,
    ]),
  );

  const shortlist: ShortlistEntry[] = [];

  for (const match of matches) {
    const interestAssessment = interestByCandidate.get(match.candidate.id);
    if (!interestAssessment) continue;

    const combinedScore = clampScore(
      match.matchScore * 0.6 + interestAssessment.interestScore * 0.4,
    );
    const recommendation = recommendationFor(combinedScore);

    shortlist.push({
      candidate: match.candidate,
      matchScore: match.matchScore,
      interestScore: interestAssessment.interestScore,
      combinedScore,
      explanation: buildExplanation(match, interestAssessment, combinedScore),
      recommendation,
      riskFlags: interestAssessment.riskFlags,
      matchExplanation: match.explanation,
      interestExplanation: interestAssessment.explanation,
      transcript: [],
    });
  }

  shortlist.sort((a, b) => b.combinedScore - a.combinedScore);

  return NextResponse.json({ shortlist }, { status: 200 });
}
