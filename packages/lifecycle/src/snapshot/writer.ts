import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { CAS } from "../cas/store.js";

export interface ManifestEntry {
  id: string;
  type: "skill" | "agent" | "team_bundle";
  version: string;
  contentHash: string;
}

export interface GenerationManifest {
  generation: number;
  createdAt: string;
  artifacts: ManifestEntry[];
  config: Record<string, unknown>;
}

export class SnapshotWriter {
  constructor(
    private readonly genRoot: string,
    _cas: CAS,
  ) {}

  async nextGenerationNumber(): Promise<number> {
    try {
      const dirs = await readdir(this.genRoot);
      const nums = dirs
        .filter(d => d.startsWith("gen-"))
        .map(d => Number(d.slice(4)));
      return nums.length === 0 ? 1 : Math.max(...nums) + 1;
    } catch {
      return 1;
    }
  }

  async write(manifest: GenerationManifest): Promise<string> {
    const n = manifest.generation.toString().padStart(5, "0");
    const dir = join(this.genRoot, `gen-${n}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "manifest.lock.yaml"), yamlStringify(manifest));
    await writeFile(join(dir, "timestamp"), manifest.createdAt);
    return dir;
  }
}
