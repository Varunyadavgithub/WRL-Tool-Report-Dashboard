export const AI_PROVIDER = process.env.AI_PROVIDER || "ollama";
export const AI_MODEL_NAME = process.env.AI_MODEL_NAME || "qwen2.5:7b-instruct";
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

// Ollama's default (0.8) is tuned for creative variety, not the numeric
// consistency this app needs — every answer here is a factual claim grounded
// in tool data, so low temperature reduces run-to-run variance and arithmetic
// slip-ups when the model restates numbers in prose.
export const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2);

// Bounds the tool-calling loop so a confused model can't spin forever.
export const AI_MAX_TOOL_ITERATIONS = Number(process.env.AI_MAX_TOOL_ITERATIONS) || 4;

// Trims conversation history sent to the model — keeps latency down on CPU inference.
export const AI_MAX_HISTORY_MESSAGES = Number(process.env.AI_MAX_HISTORY_MESSAGES) || 10;

// Ollama defaults to a 4096-token context window regardless of what the model
// actually supports — with 17 tool schemas + system prompt + history, that's
// not enough headroom and Ollama silently truncates rather than erroring.
// qwen2.5:7b supports up to 32K. System prompt + tool schemas alone are
// ~4.4K tokens (measured 2026-07-07); tool call RESULTS also get appended
// back into the same turn's context (can be sizeable for wide date ranges),
// so 8192 was cutting it close — 12288 gives real headroom without the
// RAM/latency cost of jumping straight to 32K on this CPU box.
export const AI_NUM_CTX = Number(process.env.AI_NUM_CTX) || 12288;

// Hosted Anthropic API — only used when AI_PROVIDER=anthropic. Kept separate
// from the Ollama config above since defaults/semantics differ per provider —
// e.g. Claude Sonnet 5 rejects a non-default temperature outright (400), so
// there's no shared "AI_TEMPERATURE" equivalent for this provider.
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const ANTHROPIC_MODEL_NAME = process.env.ANTHROPIC_MODEL_NAME || "claude-sonnet-5";
export const ANTHROPIC_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS) || 4096;

// Hosted Groq API — only used when AI_PROVIDER=groq. Groq's endpoint is
// OpenAI-compatible chat completions, matching this app's existing tool-call
// message shape directly — unlike Anthropic, no request/response translation
// is needed here.
export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
// Switched back to llama-3.3-70b-versatile (2026-07-08): gpt-oss-120b's 8K
// TPM free-tier ceiling proved too tight once the REPORTING STYLE prompt
// addition below made responses meaningfully longer — real users hit 429s in
// normal single-message use, not just repeated test-script traffic. 12K TPM
// gives real headroom. Known narrow risk: llama-3.3-70b previously crashed on
// its own malformed tool-call syntax specifically for compareProductionRanges'
// nested-object-plus-optional-field schema (reproduced twice) — the
// toGroqTools() null-widening fix in groqProvider.js did NOT resolve that
// specific case. If that tool's calls start failing, that's why.
export const GROQ_MODEL_NAME = process.env.GROQ_MODEL_NAME || "llama-3.3-70b-versatile";
