// Active memory window — number of recent entries Crest keeps in full detail
export const ACTIVE_WINDOW = 7;

// Model fallback chain — tried in order until one succeeds
// Free models that support the required capabilities
export const MODEL_CHAIN = [
  "qwen/qwen3.6-plus-preview:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "qwen/qwen3-coder:free",
  "stepfun/step-3.5-flash:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// Re-export primary model for config consumers
export const MODEL = MODEL_CHAIN[0];