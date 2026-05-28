import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execa, type ExecaReturnValue } from "execa";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ORQENIX_ROOT = resolve(__dirname, "..", "..");
export const PRO_ROOT = resolve(ORQENIX_ROOT, "..", "Orqenix-Pro");
export const ORQENIX_CLI = resolve(ORQENIX_ROOT, "packages", "cli", "dist", "index.js");

export interface WorkspaceContext {
  dir: string;
  cleanup: () => Promise<void>;
  cli(args: string[]): Promise<ExecaReturnValue>;
  writeFile(rel: string, content: string): Promise<void>;
  readFile(rel: string): Promise<string>;
  exists(rel: string): Promise<boolean>;
}

export async function createWorkspace(): Promise<WorkspaceContext> {
  const dir = await mkdtemp(join(tmpdir(), "orqenix-int-"));

  const cli = async (args: string[]) => {
    return execa("node", [ORQENIX_CLI, ...args], {
      cwd: dir,
      reject: false,
      all: true,
      env: { ...process.env, NO_COLOR: "1", ORQENIX_TELEMETRY: "off" },
    });
  };

  return {
    dir,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
    cli,
    async writeFile(rel, content) {
      const path = join(dir, rel);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },
    async readFile(rel) {
      return readFile(join(dir, rel), "utf8");
    },
    async exists(rel) {
      try {
        await readFile(join(dir, rel));
        return true;
      } catch {
        return false;
      }
    },
  };
}
