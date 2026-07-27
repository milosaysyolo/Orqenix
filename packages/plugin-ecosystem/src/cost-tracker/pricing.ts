export interface ModelPricing {
  input: number;
  output: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "anthropic/claude-opus-4": { input: 15.0, output: 75.0 },
  "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
  "anthropic/claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "anthropic/claude-haiku-4": { input: 0.8, output: 4.0 },
  "openai/gpt-4o": { input: 5.0, output: 15.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "ollama/qwen2.5-coder": { input: 0, output: 0 },
  "ollama/llama3.3": { input: 0, output: 0 },
};

export function priceFor(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? { input: 0, output: 0 };
}

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return (p.input * inputTokens + p.output * outputTokens) / 1_000_000;
}
