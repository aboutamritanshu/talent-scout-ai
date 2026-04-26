import OpenAI from "openai";

// OpenAI client configured for low-cost usage on gpt-4o-mini.
// The key is read from .env.local at runtime.
const apiKey = process.env.OPENAI_API_KEY;

export const DEFAULT_MODEL = "gpt-4o-mini";

export const openai = new OpenAI({
  apiKey: apiKey ?? "",
});

export function hasOpenAIKey(): boolean {
  return Boolean(apiKey && apiKey !== "your-key-here");
}
