"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = exports.DEFAULT_MODEL = void 0;
exports.hasOpenAIKey = hasOpenAIKey;
const openai_1 = __importDefault(require("openai"));
// OpenAI client configured for low-cost usage on gpt-4o-mini.
// The key is read from .env.local at runtime.
const apiKey = process.env.OPENAI_API_KEY;
exports.DEFAULT_MODEL = "gpt-4o-mini";
exports.openai = new openai_1.default({
    apiKey: apiKey ?? "",
});
function hasOpenAIKey() {
    return Boolean(apiKey && apiKey !== "your-key-here");
}
