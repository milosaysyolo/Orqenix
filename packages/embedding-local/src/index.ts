import { pipeline, env } from "@xenova/transformers";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const DIMS = 384;
const STORE = join(homedir(), ".local", "share", "orqenix", "embedding-model");

env.cacheDir = STORE;
env.localModelPath = STORE;

let _pipe: any = null;

export interface LocalEmbedder {
  dims: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

export async function createLocalEmbedder(): Promise<LocalEmbedder> {
  await mkdir(STORE, { recursive: true });
  if (!_pipe) {
    _pipe = await pipeline("feature-extraction", MODEL, {
      quantized: true,
    });
  }
  return {
    dims: DIMS,
    async embed(texts) {
      const out: Float32Array[] = [];
      for (const t of texts) {
        const r = await _pipe(t, { pooling: "mean", normalize: true });
        out.push(new Float32Array(r.data));
      }
      return out;
    },
  };
}
