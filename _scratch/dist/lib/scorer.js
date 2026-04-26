"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreCandidate = scoreCandidate;
// Weights are fixed by the project spec.
const WEIGHTS = {
    skills: 0.4,
    experience: 0.25,
    domain: 0.2,
    education: 0.15,
};
// -----------------------------------------------------------------------------
// Skill matching
// -----------------------------------------------------------------------------
// Lightweight synonym groups so "REST APIs" matches "REST API" and a candidate
// who lists "AWS" matches a JD that asks for "cloud platforms". This is a small
// deterministic lookup — not fuzzy matching — so scores stay explainable.
const SYNONYM_GROUPS = [
    ["aws", "azure", "gcp", "google cloud", "cloud", "cloud platforms", "cloud platform"],
    ["rest", "rest api", "rest apis", "restful", "restful api", "restful apis"],
    ["node", "node.js", "nodejs"],
    ["next", "next.js", "nextjs"],
    ["react", "reactjs", "react.js"],
    ["typescript", "ts"],
    ["javascript", "js"],
    ["postgres", "postgresql"],
    ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
    ["k8s", "kubernetes"],
    ["ml", "machine learning"],
    ["ai", "artificial intelligence"],
    ["sql", "postgresql", "mysql", "mssql", "t-sql"],
];
function normalizeSkill(raw) {
    return raw.toLowerCase().trim().replace(/\s+/g, " ");
}
function synonymsOf(skill) {
    const norm = normalizeSkill(skill);
    for (const group of SYNONYM_GROUPS) {
        if (group.includes(norm))
            return group;
    }
    return [norm];
}
function stripTrailingS(s) {
    return s.endsWith("s") ? s.slice(0, -1) : s;
}
function skillMatches(target, candidateSkills) {
    const targetTokens = synonymsOf(target);
    const normCandidate = candidateSkills.map(normalizeSkill);
    for (const token of targetTokens) {
        const tokenBase = stripTrailingS(token);
        for (const cand of normCandidate) {
            if (cand === token)
                return true;
            const candBase = stripTrailingS(cand);
            if (candBase === tokenBase)
                return true;
            if (cand.includes(token) || token.includes(cand))
                return true;
            // Match each candidate skill against the full synonym group too.
            for (const candSyn of synonymsOf(cand)) {
                if (candSyn === token)
                    return true;
            }
        }
    }
    return false;
}
function evalSkills(jd, candidate) {
    const required = jd.requiredSkills.filter(Boolean);
    const nice = jd.niceToHaveSkills.filter(Boolean);
    const matched = [];
    const missing = [];
    for (const skill of required) {
        if (skillMatches(skill, candidate.skills))
            matched.push(skill);
        else
            missing.push(skill);
    }
    const niceMatched = [];
    for (const skill of nice) {
        if (skillMatches(skill, candidate.skills))
            niceMatched.push(skill);
    }
    let score;
    let note;
    if (required.length === 0 && nice.length === 0) {
        score = 60;
        note = "No specific skills were listed in the JD — scored neutrally.";
    }
    else if (required.length === 0) {
        const ratio = niceMatched.length / nice.length;
        score = Math.round(60 + ratio * 40);
        note = `Matched ${niceMatched.length} of ${nice.length} nice-to-have skills.`;
    }
    else {
        const reqRatio = matched.length / required.length;
        let combined = reqRatio * 100;
        if (nice.length > 0) {
            const niceRatio = niceMatched.length / nice.length;
            combined = 0.8 * reqRatio * 100 + 0.2 * niceRatio * 100;
        }
        score = Math.round(combined);
        const parts = [
            `Matched ${matched.length} of ${required.length} required skills`,
        ];
        if (missing.length > 0)
            parts.push(`missing: ${missing.join(", ")}`);
        if (nice.length > 0) {
            parts.push(`${niceMatched.length} of ${nice.length} nice-to-have`);
        }
        note = parts.join("; ") + ".";
    }
    return {
        score: clamp(score),
        matched,
        missing,
        niceMatched,
        note,
    };
}
function evalExperience(jd, candidate) {
    const required = jd.experienceYearsRequired;
    const actual = candidate.experienceYears;
    if (required <= 0) {
        return {
            score: 75,
            note: `No minimum experience specified — candidate has ${actual} years.`,
        };
    }
    if (actual >= required) {
        const overshoot = actual - required;
        if (overshoot > 6) {
            return {
                score: 88,
                note: `${actual} years vs ${required} required — possibly over-levelled for the role.`,
            };
        }
        return {
            score: 100,
            note: `${actual} years of experience meets the ${required}+ year bar.`,
        };
    }
    const gap = required - actual;
    if (gap <= 1) {
        return {
            score: 80,
            note: `${actual} years vs ${required} required — close, within 1 year of the bar.`,
        };
    }
    if (gap <= 2) {
        return {
            score: 60,
            note: `${actual} years vs ${required} required — ${gap} year gap.`,
        };
    }
    if (gap <= 4) {
        return {
            score: 35,
            note: `${actual} years vs ${required} required — notable ${gap}-year gap.`,
        };
    }
    return {
        score: 15,
        note: `${actual} years vs ${required} required — significantly below the bar.`,
    };
}
// -----------------------------------------------------------------------------
// Domain
// -----------------------------------------------------------------------------
function tokenize(value) {
    const tokens = value
        .toLowerCase()
        .split(/[\s,/&|+\-()]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1);
    return new Set(tokens);
}
function evalDomain(jd, candidate) {
    const jdDomain = jd.domain.trim();
    const candDomain = candidate.domain.trim();
    if (!jdDomain) {
        return {
            score: 70,
            note: `No domain specified in the JD — candidate works in ${candDomain || "an unlisted domain"}.`,
        };
    }
    if (!candDomain) {
        return {
            score: 55,
            note: `Candidate's domain is not listed — JD asks for ${jdDomain}.`,
        };
    }
    const a = tokenize(jdDomain);
    const b = tokenize(candDomain);
    const overlap = [...a].filter((t) => b.has(t));
    if (jdDomain.toLowerCase() === candDomain.toLowerCase()) {
        return {
            score: 100,
            note: `Exact domain match (${candDomain}).`,
        };
    }
    if (overlap.length > 0) {
        return {
            score: 80,
            note: `Adjacent domain — overlap on "${overlap.join(", ")}" (${candDomain} vs ${jdDomain}).`,
        };
    }
    return {
        score: 40,
        note: `Different domain — candidate is in ${candDomain}, JD asks for ${jdDomain}.`,
    };
}
const DEGREE_KEYWORDS = [
    { level: 4, match: /\b(ph\.?d|doctorate|doctoral)\b/i },
    { level: 4, match: /\b(cfa|ca|cpa)\b/i },
    { level: 3, match: /\b(master|m\.?s|m\.?sc|m\.?tech|m\.?eng|mba|m\.?a)\b/i },
    { level: 2, match: /\b(bachelor|b\.?tech|b\.?e|b\.?sc|b\.?a|b\.?com|bs|b\.?des)\b/i },
    { level: 1, match: /\b(diploma|associate)\b/i },
];
function detectDegreeLevel(text) {
    if (!text)
        return 0;
    for (const { level, match } of DEGREE_KEYWORDS) {
        if (match.test(text))
            return level;
    }
    return 0;
}
function evalEducation(jd, candidate) {
    const jdReq = jd.educationRequirement.trim();
    const candEdu = candidate.education.trim();
    if (!jdReq) {
        return {
            score: 75,
            note: `No specific education requirement — candidate holds ${candEdu || "unlisted education"}.`,
        };
    }
    const required = detectDegreeLevel(jdReq);
    const actual = detectDegreeLevel(candEdu);
    if (required === 0) {
        // Fall back to keyword overlap only.
        const overlap = [...tokenize(jdReq)].filter((t) => tokenize(candEdu).has(t));
        if (overlap.length > 0) {
            return {
                score: 80,
                note: `Overlap in field of study ("${overlap.join(", ")}").`,
            };
        }
        return {
            score: 55,
            note: `Different field of study — ${candEdu || "unlisted"} vs ${jdReq}.`,
        };
    }
    if (actual === 0) {
        return {
            score: 50,
            note: `Candidate's education is unclear — JD expects ${jdReq}.`,
        };
    }
    if (actual >= required) {
        if (actual === required) {
            return {
                score: 100,
                note: `Education matches the ${jdReq} requirement (${candEdu}).`,
            };
        }
        return {
            score: 95,
            note: `Candidate holds ${candEdu} — above the required level (${jdReq}).`,
        };
    }
    const gap = required - actual;
    if (gap === 1) {
        return {
            score: 65,
            note: `One level below the stated requirement (${candEdu} vs ${jdReq}).`,
        };
    }
    return {
        score: 40,
        note: `Below the stated education bar (${candEdu} vs ${jdReq}).`,
    };
}
// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------
function clamp(value) {
    if (value < 0)
        return 0;
    if (value > 100)
        return 100;
    return Math.round(value);
}
function buildExplanation(candidate, skills, exp, domain, edu) {
    return `${candidate.name} — ${skills.note} ${exp.note} ${domain.note} ${edu.note}`;
}
function summarizeStrengthsAndGaps(breakdown, skills) {
    const strengths = [];
    const gaps = [];
    for (const row of breakdown) {
        if (row.score >= 85)
            strengths.push(`${row.label}: ${row.note}`);
        else if (row.score < 60)
            gaps.push(`${row.label}: ${row.note}`);
    }
    if (skills.niceMatched.length > 0) {
        strengths.push(`Bonus skills present: ${skills.niceMatched.join(", ")}.`);
    }
    if (skills.missing.length > 0 && !gaps.some((g) => g.startsWith("Skills"))) {
        gaps.push(`Missing required skills: ${skills.missing.join(", ")}.`);
    }
    return { strengths, gaps };
}
function scoreCandidate(candidate, jd) {
    const skills = evalSkills(jd, candidate);
    const exp = evalExperience(jd, candidate);
    const domain = evalDomain(jd, candidate);
    const edu = evalEducation(jd, candidate);
    const breakdown = [
        { label: "Skills match", weight: WEIGHTS.skills, score: skills.score, note: skills.note },
        { label: "Experience", weight: WEIGHTS.experience, score: exp.score, note: exp.note },
        { label: "Domain fit", weight: WEIGHTS.domain, score: domain.score, note: domain.note },
        { label: "Education", weight: WEIGHTS.education, score: edu.score, note: edu.note },
    ];
    const weighted = breakdown.reduce((sum, row) => sum + row.score * row.weight, 0);
    const matchScore = clamp(weighted);
    const { strengths, gaps } = summarizeStrengthsAndGaps(breakdown, skills);
    return {
        candidate,
        matchScore,
        breakdown,
        strengths,
        gaps,
        matchedSkills: skills.matched,
        missingSkills: skills.missing,
        explanation: buildExplanation(candidate, skills, exp, domain, edu),
    };
}
