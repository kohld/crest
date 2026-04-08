// Active memory window — number of recent entries Crest keeps in full detail
export const ACTIVE_WINDOW = 7;

// Model fallback chain — tried in order until one succeeds
// Free models that support the required capabilities
export const MODEL_CHAIN = [
  "stepfun/step-3.5-flash:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// Re-export primary model for config consumers
export const MODEL = MODEL_CHAIN[0];