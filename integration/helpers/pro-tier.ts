import { execa } from "execa";
import { existsSync } from "node:fs";
import { PRO_ROOT } from "./workspace.js";

export async function ensureProBuilt(): Promise<void> {
  const distExists = existsSync(`${PRO_ROOT}/packages/license/dist/index.js`);
  if (distExists) return;
  await execa("pnpm", ["build"], { cwd: PRO_ROOT });
}

export async function ensureProKeys(): Promise<void> {
  if (existsSync(`${PRO_ROOT}/keys/test-public.pem`)) return;
  await execa("pnpm", ["generate-test-keys"], { cwd: PRO_ROOT });
}

export async function runProTests(): Promise<{ ok: boolean; output: string }> {
  const r = await execa("pnpm", ["test"], {
    cwd: PRO_ROOT,
    reject: false,
    all: true,
  });
  return { ok: r.exitCode === 0, output: r.all ?? "" };
}
