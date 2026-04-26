// Shared TypeScript interfaces for the Talent Scout agent.

export interface Candidate {
  id: string;
  name: string;
  title: string;
  skills: string[];
  experienceYears: number;
  domain: string;
  education: string;
  location: string;
  currentSalary: number;
  expectedSalary: number;
  availableIn: number; // weeks until available to start
  summary: string;
}

export interface ParsedJD {
  jobTitle: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  experienceYearsRequired: number; // minimum years expected (integer)
  domain: string;
  educationRequirement: string;
  salaryRange: string; // human-readable (e.g., "18-25 LPA", "$120k-$150k")
  location: string;
  responsibilities: string[];
  seniorityLevel: string; // e.g., "Senior", "Mid", "Lead"
  rawText: string;
}

export interface ScoreBreakdown {
  label: string;
  weight: number; // 0-1
  score: number;  // 0-100
  note: string;
}

export interface MatchResult {
  candidate: Candidate;
  matchScore: number; // 0-100
  breakdown: ScoreBreakdown[];
  strengths: string[];
  gaps: string[];
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
}

export type OutreachRole = "agent" | "candidate";

export interface OutreachMessage {
  role: OutreachRole;
  content: string;
  timestamp: string;
}

export interface OutreachTranscript {
  candidateId: string;
  messages: OutreachMessage[];
  personality: "interested" | "neutral" | "unavailable";
}

export interface InterestAssessment {
  interestScore: number; // 0-100
  breakdown: ScoreBreakdown[];
  explanation: string;
  recommendation: string;
  riskFlags: string[];
  personality: "interested" | "neutral" | "unavailable";
}

export interface ShortlistEntry {
  candidate: Candidate;
  matchScore: number;
  interestScore: number;
  combinedScore: number;
  explanation: string;
  recommendation: "Hire" | "Consider" | "Reject";
  riskFlags: string[];
  matchExplanation: string;
  interestExplanation: string;
  transcript: OutreachMessage[];
}
