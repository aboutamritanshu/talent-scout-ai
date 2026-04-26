import { NextResponse } from "next/server";
import { DEFAULT_MODEL, hasOpenAIKey, openai } from "@/lib/openai";
import type {
  InterestAssessment,
  MatchResult,
  OutreachMessage,
  ParsedJD,
  ScoreBreakdown,
} from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a senior recruiting agent simulating candidate outreach for a hiring workflow.

Return ONLY a valid JSON object matching this schema:
{
  "transcript": [
    { "role": "agent" | "candidate", "content": string }
  ],
  "interestAssessment": {
    "interestScore": number,
    "breakdown": [
      { "label": string, "weight": number, "score": number, "note": string }
    ],
    "explanation": string,
    "recommendation": string,
    "riskFlags": string[],
    "personality": "interested" | "neutral" | "unavailable"
  }
}

Rules:
- The transcript must feel like a realistic recruiter-candidate chat.
- The recruiter must send a personalized opening message based on the JD and candidate profile.
- The recruiter must ask 4-5 targeted questions covering interest, availability, salary alignment, role fit, and motivation.
- The candidate replies must be realistic and consistent with their profile, expected salary, availability, and match score.
- Some strong candidates may still be cautious, unavailable, or salary-misaligned.
- Interest Score MUST use exactly these weighted categories:
  1. Responded positively to role: weight 0.30
  2. Available in required timeline: weight 0.25
  3. Salary expectations aligned: weight 0.25
  4. Showed enthusiasm markers: weight 0.20
- Each category score must be 0-100. The final interestScore must be the weighted total, rounded to the nearest integer.
- riskFlags should be short recruiter-facing strings. Use [] if no meaningful risk exists.
- recommendation should be a direct next action for the recruiter.
- Do not invent contact details, employers, or facts not present in the input.`;

interface RawOutreach {
  transcript?: unknown;
  interestAssessment?: unknown;
}

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

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toWeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeTranscript(value: unknown): OutreachMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const role = row.role === "agent" || row.role === "candidate" ? row.role : null;
      const content = toString(row.content);
      if (!role || !content) return null;

      return {
        role,
        content,
        timestamp: new Date(Date.now() + index * 60_000).toISOString(),
      };
    })
    .filter((item): item is OutreachMessage => Boolean(item));
}

function normalizeBreakdown(value: unknown): ScoreBreakdown[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = toString(row.label);
      const note = toString(row.note);
      if (!label || !note) return null;
      return {
        label,
        weight: toWeight(row.weight),
        score: toScore(row.score),
        note,
      };
    })
    .filter((item): item is ScoreBreakdown => Boolean(item));
}

function normalizeAssessment(value: unknown): InterestAssessment | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const breakdown = normalizeBreakdown(raw.breakdown);
  const personality =
    raw.personality === "interested" ||
    raw.personality === "neutral" ||
    raw.personality === "unavailable"
      ? raw.personality
      : "neutral";

  const explanation = toString(raw.explanation);
  const recommendation = toString(raw.recommendation);
  const riskFlags = isStringArray(raw.riskFlags)
    ? raw.riskFlags.map((flag) => flag.trim()).filter(Boolean)
    : [];

  if (breakdown.length !== 4 || !explanation || !recommendation) return null;

  const weightedScore = breakdown.reduce(
    (sum, row) => sum + row.score * row.weight,
    0,
  );

  return {
    interestScore: toScore(
      typeof raw.interestScore === "number" ? raw.interestScore : weightedScore,
    ),
    breakdown,
    explanation,
    recommendation,
    riskFlags,
    personality,
  };
}

function makeTimestamp(index: number): string {
  return new Date(Date.now() + index * 60_000).toISOString();
}

function inferSalaryAlignment(parsedJD: ParsedJD, matchResult: MatchResult): number {
  const salaryNumbers = parsedJD.salaryRange.match(/\d+(?:\.\d+)?/g);
  if (!salaryNumbers || salaryNumbers.length === 0) return 70;

  const upper = Number(salaryNumbers[salaryNumbers.length - 1]);
  if (!Number.isFinite(upper) || upper <= 0) return 70;

  const expected = matchResult.candidate.expectedSalary;
  const expectedInLpa = expected > 500000 ? expected / 100000 : expected / 1000;
  if (expectedInLpa <= upper) return 90;
  if (expectedInLpa <= upper * 1.2) return 65;
  return 35;
}

function buildFallbackOutreach(
  parsedJD: ParsedJD,
  matchResult: MatchResult,
  reason: string,
): { transcript: OutreachMessage[]; interestAssessment: InterestAssessment } {
  const { candidate } = matchResult;
  const positiveScore = matchResult.matchScore >= 75 ? 88 : matchResult.matchScore >= 55 ? 68 : 42;
  const availabilityScore = candidate.availableIn <= 4 ? 92 : candidate.availableIn <= 8 ? 70 : 40;
  const salaryScore = inferSalaryAlignment(parsedJD, matchResult);
  const enthusiasmScore =
    positiveScore >= 80 && salaryScore >= 60 ? 84 : positiveScore >= 60 ? 62 : 38;
  const interestScore = Math.round(
    positiveScore * 0.3 +
      availabilityScore * 0.25 +
      salaryScore * 0.25 +
      enthusiasmScore * 0.2,
  );
  const personality =
    interestScore >= 75 ? "interested" : interestScore >= 50 ? "neutral" : "unavailable";
  const riskFlags = [
    availabilityScore < 65 ? `Availability is ${candidate.availableIn} weeks` : "",
    salaryScore < 70 ? "Salary alignment needs confirmation" : "",
    matchResult.missingSkills.length > 0
      ? `Skill gap: ${matchResult.missingSkills.join(", ")}`
      : "",
  ].filter(Boolean);

  const transcript: OutreachMessage[] = [
    {
      role: "agent",
      content: `Hi ${candidate.name}, I came across your ${candidate.title} profile. Your background in ${matchResult.matchedSkills.slice(0, 3).join(", ") || candidate.skills.slice(0, 3).join(", ")} looks relevant for our ${parsedJD.jobTitle || "open role"}. Would you be open to a quick conversation?`,
      timestamp: makeTimestamp(0),
    },
    {
      role: "candidate",
      content:
        positiveScore >= 75
          ? `Thanks for reaching out. The role sounds relevant, especially given the ${parsedJD.seniorityLevel || "scope"} level and the skills you mentioned. I would be open to learning more.`
          : `Thanks for reaching out. I can take a look, though I would need to understand the scope and whether it fits my current priorities.`,
      timestamp: makeTimestamp(1),
    },
    {
      role: "agent",
      content: `What is your current availability? The role is listed as ${parsedJD.location || "flexible location"}, and we would want someone who can start without a very long delay.`,
      timestamp: makeTimestamp(2),
    },
    {
      role: "candidate",
      content:
        availabilityScore >= 80
          ? `I could realistically start in about ${candidate.availableIn} weeks, so the timeline should be manageable.`
          : `My current notice period means I would need around ${candidate.availableIn} weeks. That may be workable if the team can wait, but it is not immediate.`,
      timestamp: makeTimestamp(3),
    },
    {
      role: "agent",
      content: `The JD mentions ${parsedJD.salaryRange || "a competitive salary range"}. Does that line up with your expectations?`,
      timestamp: makeTimestamp(4),
    },
    {
      role: "candidate",
      content:
        salaryScore >= 80
          ? "That range is broadly aligned with what I would consider, assuming the role scope and benefits are clear."
          : "Compensation may need discussion. I would not rule it out, but I would want to confirm the full range before investing too much time.",
      timestamp: makeTimestamp(5),
    },
    {
      role: "agent",
      content: `From a role-fit perspective, the team needs strength in ${parsedJD.requiredSkills.slice(0, 4).join(", ") || "the core requirements"}. Which parts of this role are most motivating for you?`,
      timestamp: makeTimestamp(6),
    },
    {
      role: "candidate",
      content:
        enthusiasmScore >= 80
          ? "The mix of ownership, technical depth, and product impact is interesting. I would like to understand the team structure and what success looks like in the first six months."
          : "The work could be interesting, but I would need more clarity on ownership, expectations, and whether the role is a real step forward for me.",
      timestamp: makeTimestamp(7),
    },
  ];

  const breakdown: ScoreBreakdown[] = [
    {
      label: "Responded positively to role",
      weight: 0.3,
      score: positiveScore,
      note:
        positiveScore >= 75
          ? "Candidate responded positively to the role premise."
          : "Candidate was cautious about the role premise.",
    },
    {
      label: "Available in required timeline",
      weight: 0.25,
      score: availabilityScore,
      note: `${candidate.availableIn}-week availability based on candidate profile.`,
    },
    {
      label: "Salary expectations aligned",
      weight: 0.25,
      score: salaryScore,
      note:
        salaryScore >= 80
          ? "Expected salary appears aligned with the JD range."
          : "Compensation should be clarified early.",
    },
    {
      label: "Showed enthusiasm markers",
      weight: 0.2,
      score: enthusiasmScore,
      note:
        enthusiasmScore >= 75
          ? "Candidate asked useful follow-up questions and showed motivation."
          : "Candidate showed limited enthusiasm markers.",
    },
  ];

  return {
    transcript,
    interestAssessment: {
      interestScore,
      breakdown,
      explanation: `Fallback simulated outreach (${reason}). ${candidate.name} is ${personality}; the main signals are ${interestScore}/100 interest, ${candidate.availableIn}-week availability, and ${riskFlags.length > 0 ? riskFlags.join("; ") : "no major flagged risk"}.`,
      recommendation:
        interestScore >= 75
          ? "Schedule recruiter screen and confirm compensation details."
          : interestScore >= 50
            ? "Keep warm and clarify risk areas before moving forward."
            : "Do not prioritize unless the role constraints change.",
      riskFlags,
      personality,
    },
  };
}

function fallbackResponse(
  parsedJD: ParsedJD,
  matchResult: MatchResult,
  reason: string,
) {
  const fallback = buildFallbackOutreach(parsedJD, matchResult, reason);
  return NextResponse.json(
    {
      ...fallback,
      fallback: true,
      fallbackReason: reason,
    },
    { status: 200 },
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
  const matchResult =
    body && typeof body === "object" && "matchResult" in body
      ? (body as { matchResult: unknown }).matchResult
      : undefined;

  if (!isParsedJD(parsedJD) || !isMatchResult(matchResult)) {
    return NextResponse.json(
      {
        error:
          "Fields 'parsedJD' and 'matchResult' are required and must match the expected shapes.",
      },
      { status: 400 },
    );
  }

  if (!hasOpenAIKey()) {
    return fallbackResponse(parsedJD, matchResult, "OpenAI API key not configured");
  }

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            parsedJD,
            matchResult,
            instruction:
              "Simulate outreach and produce the weighted interest assessment.",
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return fallbackResponse(parsedJD, matchResult, "OpenAI returned an empty response");
    }

    let raw: RawOutreach;
    try {
      raw = JSON.parse(content) as RawOutreach;
    } catch {
      return fallbackResponse(parsedJD, matchResult, "OpenAI returned invalid JSON");
    }

    const transcript = normalizeTranscript(raw.transcript);
    const interestAssessment = normalizeAssessment(raw.interestAssessment);

    if (transcript.length < 8 || !interestAssessment) {
      return fallbackResponse(parsedJD, matchResult, "OpenAI returned an invalid outreach structure");
    }

    return NextResponse.json(
      { transcript, interestAssessment },
      { status: 200 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error from the AI service.";
    return fallbackResponse(parsedJD, matchResult, `OpenAI outreach failed: ${message}`);
  }
}
