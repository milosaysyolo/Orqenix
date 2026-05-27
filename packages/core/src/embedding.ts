export interface Embedder {
  dims: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

interface EmbeddingModule<T> {
  default?: T;
  [k: string]: unknown;
}

async function importOptional<T>(spec: string): Promise<T | null> {
  try {
    const mod = (await import(spec)) as EmbeddingModule<T>;
    return ((mod.default ?? mod) as T) ?? null;
  } catch {
    return null;
  }
}

interface LocalFactory {
  createLocalEmbedder: () => Promise<Embedder>;
}

interface CloudFactory {
  createCloudEmbedder: (cfg: unknown) => Promise<Embedder>;
}

export async function resolveEmbedder(cfg: {
  primary: "local" | "cloud";
  cloud?: unknown;
}): Promise<Embedder> {
  if (cfg.primary === "cloud" && cfg.cloud) {
    const cloud = await importOptional<CloudFactory>("@orqenix/embedding-cloud");
    if (cloud?.createCloudEmbedder) {
      try {
        return await cloud.createCloudEmbedder(cfg.cloud);
      } catch {
        // fall through to local
      }
    }
  }
  const local = await importOptional<LocalFactory>("@orqenix/embedding-local");
  if (!local?.createLocalEmbedder) {
    throw new Error(
      "No embedding provider available. Install @orqenix/embedding-local.",
    );
  }
  return local.createLocalEmbedder();
}
