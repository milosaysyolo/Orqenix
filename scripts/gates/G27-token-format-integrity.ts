import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  computeJti,
  encodeToken,
  decodeToken,
  base64UrlEncode,
  base64UrlDecode,
} from "@orqenix/capability-tokens";
import type { CapabilityToken, TokenPayload, TokenId } from "@orqenix/capability-tokens";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

function payload(seed: number): TokenPayload {
  return {
    iss: "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    sub: "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    aud: "scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    iat: 1000 + seed,
    nbf: 1000 + seed,
    exp: 2000 + seed,
    jti: "tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD" as TokenId,
    caps: ["read:kb-docs"],
    maxDelegationDepth: 0,
  };
}

class G27 extends GateRunner {
  readonly id = "G27";
  readonly title = "Token Format Integrity";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G27.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G27.1", "unit tests pass", () => {
        execSync("pnpm --filter @orqenix/capability-tokens test", {
          cwd: REPO_ROOT,
          stdio: "pipe",
        });
      }),
      await this.check("G27.2", "500 base64url round-trips", () => {
        for (let i = 0; i < 500; i++) {
          const len = 1 + (i % 100);
          const bytes = new Uint8Array(len);
          for (let j = 0; j < len; j++) bytes[j] = (i * j) & 0xff;
          const back = base64UrlDecode(base64UrlEncode(bytes));
          if (back.length !== bytes.length) throw new Error(`length mismatch iter ${i}`);
          for (let j = 0; j < len; j++)
            if (back[j] !== bytes[j]) throw new Error(`byte mismatch iter ${i}`);
        }
      }),
      await this.check("G27.3", "200 token encode/decode round-trips", () => {
        for (let i = 0; i < 200; i++) {
          const t: CapabilityToken = {
            header: {
              alg: "EdDSA",
              typ: "ORQX",
              kid: "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as any,
            },
            payload: payload(i),
            signature: new Uint8Array(64).fill(i & 0xff),
          };
          const back = decodeToken(encodeToken(t));
          if (back.payload.iat !== t.payload.iat) throw new Error("iat lost");
        }
      }),
      await this.check("G27.4", "jti derivation deterministic across 200 runs", () => {
        const p = payload(7);
        const { jti: _, ...rest } = p;
        const first = computeJti(rest);
        for (let i = 0; i < 200; i++) {
          if (computeJti(rest) !== first) throw new Error(`non-deterministic at iter ${i}`);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G27-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G27();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G27 crashed:", e);
  process.exit(2);
});
