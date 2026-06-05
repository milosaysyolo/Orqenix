import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateKeyPair, deriveScopeId } from "@orqenix/scope-identity";
import {
  issueToken,
  RevocationStore,
  TokenVerifier,
  TokenRevokedError,
} from "@orqenix/capability-tokens";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G32 extends GateRunner {
  readonly id = "G32";
  readonly title = "Token Revocation";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G32.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G32.1", "revocation tests pass", () => {
        execSync(
          "pnpm --filter @orqenix/capability-tokens exec vitest run test/revocation.test.ts",
          { cwd: REPO_ROOT, stdio: "pipe" },
        );
      }),
      await this.check("G32.2", "30 revoke + isRevoked roundtrips", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g32-"));
        try {
          const store = new RevocationStore(dir);
          for (let i = 0; i < 30; i++) {
            const kp = await generateKeyPair();
            const iss = deriveScopeId(kp.publicKey);
            const { token } = await issueToken({
              issuerScopeId: iss,
              issuerPrivateKey: kp.privateKey,
              subjectScopeId: iss,
              audienceScopeId: iss,
              caps: ["read:kb-docs"],
              ttlSeconds: 60,
            });
            await store.revoke(token.payload.jti as any, `iter-${i}`, iss);
            if (!(await store.isRevoked(token.payload.jti as any)))
              throw new Error(`not detected iter ${i}`);
          }
          const list = await store.listRevocations();
          if (list.length !== 30) throw new Error(`expected 30, got ${list.length}`);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      await this.check("G32.3", "verifier rejects revoked token", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g32-v-"));
        try {
          const kp = await generateKeyPair();
          const iss = deriveScopeId(kp.publicKey);
          const { token, encoded } = await issueToken({
            issuerScopeId: iss,
            issuerPrivateKey: kp.privateKey,
            subjectScopeId: iss,
            audienceScopeId: iss,
            caps: ["read:kb-docs"],
            ttlSeconds: 3600,
          });
          const store = new RevocationStore(dir);
          await store.revoke(token.payload.jti as any, "compromised", iss);
          const v = new TokenVerifier({
            getIssuerPublicKey: async () => kp.publicKey,
            revocationStore: store,
          });
          let caught = false;
          try {
            await v.verify(encoded, "read:kb-docs");
          } catch (e) {
            caught = e instanceof TokenRevokedError;
          }
          if (!caught) throw new Error("revoked token was not rejected");
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      await this.check("G32.4", "revocation list ordering stable", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g32-ord-"));
        try {
          const store = new RevocationStore(dir);
          const iss = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
          const ids: string[] = [];
          for (let i = 0; i < 10; i++) {
            const jti = `tok:${"A".repeat(31)}${String.fromCharCode(65 + i)}`;
            ids.push(jti);
            await store.revoke(jti as any, `r-${i}`, iss);
            await new Promise((r) => setTimeout(r, 5));
          }
          const list = await store.listRevocations();
          for (let i = 1; i < list.length; i++) {
            if (list[i].revokedAt < list[i - 1].revokedAt) throw new Error("list not sorted");
          }
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G32-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G32();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G32 crashed:", e);
  process.exit(2);
});
