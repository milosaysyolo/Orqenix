#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

const checks: { name: string; cmd: string }[] = [
  { name: "lifecycle", cmd: "pnpm --filter @orqenix/lifecycle test" },
  { name: "embedding", cmd: "pnpm --filter @orqenix/embedding-* test" },
  { name: "knowledge", cmd: "pnpm --filter @orqenix/kb-* test" },
  { name: "marketplace", cmd: "pnpm --filter @orqenix/marketplace-client test" },
  { name: "prettier", cmd: "pnpm exec prettier --check ." },
  { name: "typecheck", cmd: "pnpm typecheck" },
  { name: "build", cmd: "pnpm build" },
];

let failed = 0;
for (const c of checks) {
  process.stdout.write(`▶ ${c.name} ... `);
  const r = spawnSync(c.cmd, { shell: true, stdio: "inherit" });
  if (r.status === 0) {
    console.log("OK");
  } else {
    console.log("FAIL");
    failed++;
  }
}

process.exit(failed === 0 ? 0 : 1);
