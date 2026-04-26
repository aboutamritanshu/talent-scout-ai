# TalentScout AI

TalentScout AI is an AI-powered recruiting workflow built for the Catalyst Hackathon. It takes a job description, parses the hiring requirements, ranks candidates from a seeded demo talent pool, simulates outreach conversations, measures candidate interest, and produces a recruiter-ready shortlist.

## Problem Statement

Recruiters spend hours reviewing profiles and chasing candidate interest. The challenge is to build an AI agent that can turn a job description into an actionable ranked shortlist using two dimensions:

- Match Score: how well the candidate fits the role.
- Interest Score: how likely the candidate is to move forward after outreach.

## What The App Does

TalentScout AI guides a recruiter through the full recruiting workflow:

1. Paste or autofill a job description.
2. Parse the JD into structured hiring criteria.
3. Score and rank candidates with transparent explanations.
4. Simulate recruiter-candidate outreach and calculate interest.
5. Produce a final ranked shortlist with recommendations and risk flags.

Candidate discovery uses `data/candidates.json`, a seeded set of 15 realistic mock candidates across engineering, product, design, marketing, finance, and data. The app does not scrape websites or contact real candidates.

## Key Features

- JD parsing with OpenAI `gpt-4o-mini`.
- Demo-safe fallback parsing when OpenAI quota or API access is unavailable.
- Deterministic candidate matching with no random scoring.
- Explainable score breakdowns for skills, experience, domain, and education.
- Simulated outreach conversation with realistic candidate responses.
- Interest scoring across role response, availability, salary alignment, and enthusiasm.
- Final shortlist ranked by combined score.
- Recruiter summary: best candidate, backup candidate, biggest risk, next action.
- Export shortlist as JSON.
- Local-first demo flow using browser `localStorage`.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- OpenAI SDK with `gpt-4o-mini`
- Static JSON candidate data
- Browser `localStorage` for demo workflow state

## Setup

```bash
git clone <your-repo-url>
cd talent-scout
npm install
npm run dev
```

Open `http://localhost:3000`.

Create `.env.local` manually before running with a real OpenAI key, or keep the placeholder for demo-safe fallback mode:

```env
OPENAI_API_KEY=your-key-here
```

The app still runs without a valid OpenAI key because JD parsing and outreach include fallback responses for demo safety.

## Demo Flow

1. Open the app and click **Start New Search**.
2. Go to **JD Input** and click **Use Sample JD**.
3. Click **Parse & Find Candidates**.
4. Review the parsed JD summary, then click **View Matching Candidates**.
5. Review ranked candidate cards and score explanations.
6. Click **Simulate Outreach** on a strong candidate.
7. Review the chat transcript, Interest Score, recommendation, and risk flags.
8. Click **Add to Shortlist**.
9. Review the final shortlist summary and export JSON if needed.

## Scoring Logic

### Match Score

Match Score is deterministic and calculated in `lib/scorer.ts`.

```text
Match Score =
  Skills match      40%
  Experience level  25%
  Domain/industry   20%
  Education         15%
```

The scorer returns:

- Total match score.
- Category-level score breakdown.
- Matched skills.
- Missing skills.
- Strengths.
- Gaps.
- Plain-English explanation.

### Interest Score

Interest Score is generated after simulated outreach.

```text
Interest Score =
  Positive role response   30%
  Availability             25%
  Salary alignment         25%
  Enthusiasm markers       20%
```

The outreach result returns:

- Transcript.
- Interest score.
- Score breakdown.
- Recommendation.
- Risk flags.
- Explanation.

### Combined Score

The final shortlist combines the two completed scores:

```text
Combined Score = (Match Score * 0.6) + (Interest Score * 0.4)
```

The shortlist API does not recompute Match Score or Interest Score. It only combines existing scores and sorts candidates by Combined Score.

## Architecture

```text
+-------------------+
| Recruiter UI      |
| Next.js App       |
+---------+---------+
          |
          v
+-------------------+       +-------------------+
| /api/parse-jd     | ----> | OpenAI gpt-4o-mini|
| JD -> ParsedJD    |       | or fallback parser |
+---------+---------+       +-------------------+
          |
          v
+-------------------+       +-------------------+
| localStorage      | ----> | /api/match-       |
| parsed JD         |       | candidates        |
+---------+---------+       +---------+---------+
                                      |
                                      v
                            +-------------------+
                            | data/candidates   |
                            | lib/scorer.ts     |
                            +---------+---------+
                                      |
                                      v
+-------------------+       +-------------------+
| /api/simulate-    | <---- | selected match    |
| outreach          |       | + parsed JD       |
+---------+---------+       +-------------------+
          |
          v
+-------------------+
| localStorage      |
| outreach result   |
+---------+---------+
          |
          v
+-------------------+
| /api/shortlist    |
| combined ranking  |
+---------+---------+
          |
          v
+-------------------+
| Shortlist UI      |
| summary + export  |
+-------------------+
```

## Folder Structure

```text
talent-scout/
|-- app/
|   |-- page.tsx
|   |-- layout.tsx
|   |-- globals.css
|   |-- jd-input/page.tsx
|   |-- candidates/page.tsx
|   |-- outreach/[id]/page.tsx
|   |-- shortlist/page.tsx
|   `-- api/
|       |-- parse-jd/route.ts
|       |-- match-candidates/route.ts
|       |-- simulate-outreach/route.ts
|       `-- shortlist/route.ts
|-- components/
|   `-- WorkflowProgress.tsx
|-- data/
|   `-- candidates.json
|-- lib/
|   |-- openai.ts
|   |-- scorer.ts
|   `-- types.ts
|-- README.md
|-- package.json
|-- tailwind.config.ts
`-- tsconfig.json
```

## Sample JD Input

```text
We are hiring a Senior React Developer with 4+ years experience in React, TypeScript, Node.js. Must have experience with REST APIs and cloud platforms (AWS preferred). Competitive salary 18-25 LPA. Remote-friendly.
```

## Sample Output Summary

```json
{
  "bestCandidate": "Priya Raman",
  "matchScore": 82,
  "interestScore": 65,
  "combinedScore": 75,
  "recommendation": "Hire",
  "riskFlags": [
    "Salary alignment needs confirmation",
    "Skill gap: REST APIs"
  ]
}
```

Actual values may differ depending on the parsed JD and outreach response. When OpenAI is unavailable, the app returns marked fallback responses so the demo remains end-to-end.

## Hackathon Demo Script

### 3-5 Minute Walkthrough

1. **Start at the dashboard**
   - Explain that TalentScout AI is a recruiter workflow, not just a scoring page.
   - Click **Start New Search**.

2. **Parse the JD**
   - Click **Use Sample JD**.
   - Click **Parse & Find Candidates**.
   - Explain the extracted fields: title, skills, experience, location, salary.
   - Mention fallback parsing keeps the demo safe if API quota is unavailable.

3. **Review matches**
   - Click **View Matching Candidates**.
   - Point out Match Score and category score bars.
   - Explain the formula: skills 40%, experience 25%, domain 20%, education 15%.
   - Show matched skills, missing skills, and explanation.

4. **Simulate outreach**
   - Click **Simulate Outreach** on a top candidate.
   - Walk through the chat transcript.
   - Explain that the outreach is simulated and not sent to real people.
   - Explain Interest Score: role response 30%, availability 25%, salary alignment 25%, enthusiasm 20%.

5. **Show shortlist**
   - Click **Add to Shortlist**.
   - Explain Combined Score: Match 60% + Interest 40%.
   - Show best candidate, backup candidate, biggest risk, and recommended next action.
   - Click **Export Shortlist as JSON** to show recruiter-ready output.

## Trade-Offs

- Candidate discovery is seeded mock data, not live sourcing. This keeps the hackathon demo reliable and avoids scraping or contacting real candidates.
- Outreach is simulated. This matches the problem statement while avoiding real email, LinkedIn, or SMS integrations.
- Browser `localStorage` is used for workflow state. This keeps setup simple but is not intended as production persistence.
- Fallback parsing and outreach are rule-based and marked internally. They prioritize demo continuity over AI richness when OpenAI quota is unavailable.
- The scoring model is transparent and deterministic rather than learned from historical hiring data.

## Future Improvements

- Add authenticated recruiter accounts and persistent searches.
- Connect to an applicant tracking system or candidate CRM.
- Add consent-based real outreach integrations.
- Support multiple candidates in outreach batches.
- Add richer compensation normalization across currencies and regions.
- Add evaluator tests for scoring consistency.
- Add PDF/Docx resume ingestion.
- Add audit logs for every ranking decision.

## Verification

The current project has been verified with:

```bash
npm run lint
npm run build
```

Both commands pass.
