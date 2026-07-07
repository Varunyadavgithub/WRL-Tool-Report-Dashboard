import { AI_PROVIDER } from "../config.js";
import ollamaProvider from "./ollamaProvider.js";

const PROVIDERS = {
  ollama: ollamaProvider,
};

// Sole swap point: point AI_PROVIDER at a different key (and register it above)
// to change model/runtime without touching agent.js, tools, or controllers.
export const getProvider = () => {
  const provider = PROVIDERS[AI_PROVIDER];
  if (!provider) throw new Error(`Unknown AI_PROVIDER: ${AI_PROVIDER}`);
  return provider;
};
