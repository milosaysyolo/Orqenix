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

export async function createCloudEmbedder(
  cfg: CloudEmbedderConfig,
): Promise<CloudEmbedder> {
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

async function openaiEmbedder(_cfg: CloudEmbedderConfig): Promise<CloudEmbedder> {
  return {
    dims: 1536,
    async embed(texts) {
      return texts.map(() => new Float32Array(1536));
    },
  };
}

async function anthropicEmbedder(
  _cfg: CloudEmbedderConfig,
): Promise<CloudEmbedder> {
  return {
    dims: 1024,
    async embed(texts) {
      return texts.map(() => new Float32Array(1024));
    },
  };
}

async function cohereEmbedder(_cfg: CloudEmbedderConfig): Promise<CloudEmbedder> {
  return {
    dims: 1024,
    async embed(texts) {
      return texts.map(() => new Float32Array(1024));
    },
  };
}

export { withRetry };
