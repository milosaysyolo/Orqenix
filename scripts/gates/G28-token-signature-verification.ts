import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { generateKeyPair, deriveScopeId } from "@orqenix/scope-identity";
import { issueToken, delegateToken, TokenVerifier } from "@orqenix/capability-tokens";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

async function newScope() {
  const kp = await generateKeyPair();
  return { ...kp, scopeId: deriveScopeId(kp.publicKey) };
}

class G28 extends GateRunner {
  readonly id = "G28";
  readonly title = "Token Signature Verification";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G28.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G28.1", "signing tests pass", () => {
        execSync("pnpm --filter @orqenix/capability-tokens exec vitest run test/signing.test.ts", {
          cwd: REPO_ROOT,
          stdio: "pipe",
        });
      }),
      await this.check("G28.2", "50 fresh sign/verify roundtrips", async () => {
        for (let i = 0; i < 50; i++) {
          const iss = await newScope();
          const { encoded } = await issueToken({
            issuerScopeId: iss.scopeId,
            issuerPrivateKey: iss.privateKey,
            subjectScopeId: iss.scopeId,
            audienceScopeId: iss.scopeId,
            caps: ["read:kb-docs"],
            ttlSeconds: 60,
          });
          const v = new TokenVerifier({ getIssuerPublicKey: async () => iss.publicKey });
          await v.verify(encoded, "read:kb-docs");
        }
      }),
      await this.check("G28.3", "50 tampers all rejected", async () => {
        for (let i = 0; i < 50; i++) {
          const iss = await newScope();
          const { encoded } = await issueToken({
            issuerScopeId: iss.scopeId,
            issuerPrivateKey: iss.privateKey,
            subjectScopeId: iss.scopeId,
            audienceScopeId: iss.scopeId,
            caps: ["read:kb-docs"],
            ttlSeconds: 60,
          });
          const parts = encoded.split(".");
          const c = parts[1][10];
          parts[1] = parts[1].slice(0, 10) + (c === "A" ? "B" : "A") + parts[1].slice(11);
          const tampered = parts.join(".");
          const v = new TokenVerifier({ getIssuerPublicKey: async () => iss.publicKey });
          let caught = false;
          try {
            await v.verify(tampered, "read:kb-docs");
          } catch {
            caught = true;
          }
          if (!caught) throw new Error(`tamper not caught iter ${i}`);
        }
      }),
      await this.check("G28.4", "delegation chain depth respected", async () => {
        const rootScope = await newScope();
        const mid = await newScope();
        const leaf = await newScope();
        const { token: p } = await issueToken({
          issuerScopeId: rootScope.scopeId,
          issuerPrivateKey: rootScope.privateKey,
          subjectScopeId: mid.scopeId,
          audienceScopeId: rootScope.scopeId,
          caps: ["delegate:*", "read:*"],
          ttlSeconds: 3600,
          maxDelegationDepth: 1,
        });
        const { token: child } = await delegateToken({
          parentToken: p,
          parentPrivateKey: mid.privateKey,
          newSubjectScopeId: leaf.scopeId,
          caps: ["read:kb-docs"],
          ttlSeconds: 60,
        });
        if (child.payload.maxDelegationDepth !== 0) throw new Error("depth not decremented");
      }),
      await this.check("G28.5", "expired token rejected with skew applied", async () => {
        const iss = await newScope();
        let t = 1_000_000;
        const { encoded } = await issueToken({
          issuerScopeId: iss.scopeId,
          issuerPrivateKey: iss.privateKey,
          subjectScopeId: iss.scopeId,
          audienceScopeId: iss.scopeId,
          caps: ["read:kb-docs"],
          ttlSeconds: 60,
          now: () => t,
        });
        t += 3600;
        const v = new TokenVerifier({
          getIssuerPublicKey: async () => iss.publicKey,
          now: () => t,
          clockSkewSeconds: 30,
        });
        let caught = false;
        try {
          await v.verify(encoded, "read:kb-docs");
        } catch {
          caught = true;
        }
        if (!caught) throw new Error("expired not caught");
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G28-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G28();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G28 crashed:", e);
  process.exit(2);
});
