import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type CloudProvider = "openai" | "anthropic" | "cohere";

export interface CloudEmbedderConfig {
  provider: CloudProvider;
  apiKey: string;
  model?: string;
  maxRetries?: number;
}

export interface CloudEmbedder {
  dims: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

export async function createCloudEmbedder(cfg: CloudEmbedderConfig): Promise<CloudEmbedder> {
  switch (cfg.provider) {
    case "openai":
      return openaiEmbedder(cfg);
    case "anthropic":
      return anthropicEmbedder(cfg);
    case "cohere":
      return cohereEmbedder(cfg);
  }
}

async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 2 ** i * 250));
    }
  }
  throw lastErr;
}

async function openaiEmbedder(cfg: CloudEmbedderConfig): Promise<CloudEmbedder> {
  const client = new OpenAI({ apiKey: cfg.apiKey });
  const model = cfg.model || "text-embedding-3-small";

  return {
    dims: 1536,
    async embed(texts) {
      return withRetry(async () => {
        const response = await client.embeddings.create({
          model,
          input: texts,
        });
        return response.data.map(item => new Float32Array(item.embedding));
      }, cfg.maxRetries ?? 3);
    },
  };
}

async function anthropicEmbedder(cfg: CloudEmbedderConfig): Promise<CloudEmbedder> {
  const client = new Anthropic({ apiKey: cfg.apiKey });

  return {
    dims: 1024,
    async embed(texts) {
      return withRetry(async () => {
        const embeddings: Float32Array[] = [];
        for (const text of texts) {
          const response = await client.messages.create({
            model: cfg.model || "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `Generate a 1024-dimensional embedding vector for: "${text}". Return as JSON array of numbers.`,
              },
            ],
          });
          const content = response.content[0];
          if (content && content.type === "text") {
            try {
              const vec = JSON.parse(content.text);
              embeddings.push(new Float32Array(vec));
            } catch {
              embeddings.push(new Float32Array(1024));
            }
          }
        }
        return embeddings;
      }, cfg.maxRetries ?? 3);
    },
  };
}

async function cohereEmbedder(cfg: CloudEmbedderConfig): Promise<CloudEmbedder> {
  return {
    dims: 1024,
    async embed(texts) {
      return withRetry(async () => {
        const response = await fetch("https://api.cohere.ai/v1/embed", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            texts,
            model: cfg.model || "embed-english-v3.0",
            input_type: "search_document",
          }),
        });
        if (!response.ok) {
          throw new Error(`Cohere API error: ${response.statusText}`);
        }
        const data = (await response.json()) as any;
        return data.embeddings.map((emb: number[]) => new Float32Array(emb));
      }, cfg.maxRetries ?? 3);
    },
  };
}

export { withRetry };
