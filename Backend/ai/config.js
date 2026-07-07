export const AI_PROVIDER = process.env.AI_PROVIDER || "ollama";
export const AI_MODEL_NAME = process.env.AI_MODEL_NAME || "qwen2.5:7b-instruct";
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

// Bounds the tool-calling loop so a confused model can't spin forever.
export const AI_MAX_TOOL_ITERATIONS = Number(process.env.AI_MAX_TOOL_ITERATIONS) || 4;

// Trims conversation history sent to the model — keeps latency down on CPU inference.
export const AI_MAX_HISTORY_MESSAGES = Number(process.env.AI_MAX_HISTORY_MESSAGES) || 10;

// Ollama defaults to a 4096-token context window regardless of what the model
// actually supports — with 14 tool schemas + system prompt + history, that's
// not enough headroom and Ollama silently truncates rather than erroring.
// qwen2.5:7b supports up to 32K; 8192 is a safe middle ground for this CPU box.
export const AI_NUM_CTX = Number(process.env.AI_NUM_CTX) || 8192;
