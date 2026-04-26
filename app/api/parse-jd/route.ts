import { NextResponse } from "next/server";
import { openai, DEFAULT_MODEL, hasOpenAIKey } from "@/lib/openai";
import type { ParsedJD } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an experienced technical recruiter. Your job is to parse raw job descriptions into structured JSON for a downstream matching system.

Return ONLY a single valid JSON object that matches this schema exactly (no prose, no markdown):
{
  "jobTitle": string,
  "requiredSkills": string[],
  "niceToHaveSkills": string[],
  "experienceYearsRequired": number,
  "domain": string,
  "educationRequirement": string,
  "salaryRange": string,
  "location": string,
  "responsibilities": string[],
  "seniorityLevel": string
}

Rules:
- experienceYearsRequired is the minimum years of experience as an integer. "4+ years" -> 4. "3-5 years" -> 3. If unspecified -> 0.
- seniorityLevel should be one of: "Intern", "Junior", "Mid", "Senior", "Lead", "Staff", "Principal", "Manager", "Director", "Executive". Use "" if unclear.
- salaryRange is a short human-readable string copied in the style of the JD (e.g., "18-25 LPA", "$120k-$150k", "Competitive"). Use "" if absent.
- domain is the industry (e.g., "SaaS", "Fintech", "E-commerce", "Healthcare", "Consumer Mobile"). Use "" if unclear.
- requiredSkills are true must-haves; niceToHaveSkills are "preferred", "bonus", or "a plus".
- location may be a city, country, "Remote", "Hybrid", "Remote-friendly", etc., or "".
- responsibilities is a short list of the core day-to-day responsibilities (3-6 bullets, each a short phrase). Use [] if not stated.
- Never invent facts. If the JD does not mention a field, use the appropriate empty value.`;

interface RawParsed {
  jobTitle?: unknown;
  requiredSkills?: unknown;
  niceToHaveSkills?: unknown;
  experienceYearsRequired?: unknown;
  domain?: unknown;
  educationRequirement?: unknown;
  salaryRange?: unknown;
  location?: unknown;
  responsibilities?: unknown;
  seniorityLevel?: unknown;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function toNonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) return Math.max(0, parseInt(match[0], 10));
  }
  return 0;
}

function normalize(raw: RawParsed, rawText: string): ParsedJD {
  return {
    jobTitle: toTrimmedString(raw.jobTitle),
    requiredSkills: toStringArray(raw.requiredSkills),
    niceToHaveSkills: toStringArray(raw.niceToHaveSkills),
    experienceYearsRequired: toNonNegativeInt(raw.experienceYearsRequired),
    domain: toTrimmedString(raw.domain),
    educationRequirement: toTrimmedString(raw.educationRequirement),
    salaryRange: toTrimmedString(raw.salaryRange),
    location: toTrimmedString(raw.location),
    responsibilities: toStringArray(raw.responsibilities),
    seniorityLevel: toTrimmedString(raw.seniorityLevel),
    rawText,
  };
}

function fallbackParseJD(jdText: string): ParsedJD {
  const lower = jdText.toLowerCase();
  const skillCatalog = [
    "React",
    "TypeScript",
    "Node.js",
    "REST APIs",
    "AWS",
    "Cloud platforms",
    "Python",
    "SQL",
    "Figma",
    "Excel",
    "Financial Modeling",
    "Product Analytics",
  ];
  const foundSkills = skillCatalog.filter((skill) =>
    lower.includes(skill.toLowerCase()),
  );
  const experienceMatch = jdText.match(/(\d+)\s*\+?\s*(?:years|yrs)/i);
  const salaryMatch = jdText.match(
    /(?:salary|compensation|pay)?\s*([$₹]?\s*\d+(?:\.\d+)?\s*[-–]\s*[$₹]?\s*\d+(?:\.\d+)?\s*(?:lpa|k|lakhs?|usd|inr)?)/i,
  );
  const titleMatch = jdText.match(
    /\b(?:hiring|hire|seeking|looking for)\s+(?:a|an)?\s*([^.,\n]+)/i,
  );
  const isRemoteFriendly = /remote-friendly/i.test(jdText);
  const isRemote = /\bremote\b/i.test(jdText);
  const isHybrid = /\bhybrid\b/i.test(jdText);

  const requiredSkills = foundSkills.filter(
    (skill) => !["AWS", "Cloud platforms"].includes(skill),
  );
  const niceToHaveSkills = foundSkills.filter((skill) =>
    ["AWS", "Cloud platforms"].includes(skill),
  );

  return {
    jobTitle: titleMatch?.[1]?.trim() || "Role from pasted JD",
    requiredSkills,
    niceToHaveSkills,
    experienceYearsRequired: experienceMatch
      ? Math.max(0, parseInt(experienceMatch[1], 10))
      : 0,
    domain: "",
    educationRequirement: "",
    salaryRange: salaryMatch?.[1]?.trim() || "",
    location: isRemoteFriendly
      ? "Remote-friendly"
      : isRemote
        ? "Remote"
        : isHybrid
          ? "Hybrid"
          : "",
    responsibilities: [],
    seniorityLevel: /\bsenior\b/i.test(jdText)
      ? "Senior"
      : /\blead\b/i.test(jdText)
        ? "Lead"
        : /\bmanager\b/i.test(jdText)
          ? "Manager"
          : "",
    rawText: jdText,
  };
}

function fallbackResponse(jdText: string, reason: string) {
  return NextResponse.json(
    {
      parsed: fallbackParseJD(jdText),
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

  const jdTextRaw =
    body && typeof body === "object" && "jdText" in body
      ? (body as { jdText: unknown }).jdText
      : undefined;

  if (typeof jdTextRaw !== "string") {
    return NextResponse.json(
      { error: "Field 'jdText' is required and must be a string." },
      { status: 400 },
    );
  }

  const jdText = jdTextRaw.trim();
  if (jdText.length < 50) {
    return NextResponse.json(
      {
        error:
          "Job description is too short. Please paste at least 50 characters so the agent has enough context.",
      },
      { status: 400 },
    );
  }

  if (!hasOpenAIKey()) {
    return fallbackResponse(jdText, "OpenAI API key not configured");
  }

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse this job description:\n\n${jdText}` },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return fallbackResponse(jdText, "OpenAI returned an empty response");
    }

    let raw: RawParsed;
    try {
      raw = JSON.parse(content) as RawParsed;
    } catch {
      return fallbackResponse(jdText, "OpenAI returned invalid JSON");
    }

    const parsed = normalize(raw, jdText);
    return NextResponse.json({ parsed }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error from the AI service.";
    return fallbackResponse(jdText, `OpenAI parse failed: ${message}`);
  }
}
