import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdtemp, rm, stat, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { platform } from "node:os";
import {
  initScope,
  generateKeyPair,
  deriveScopeId,
  serializeScopeYaml,
  parseScopeYaml,
  serializePublicKey,
  verifyScopeYamlConsistency,
  type ScopeYaml,
} from "@orqenix/scope-identity";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const IS_WIN = platform() === "win32";

class G26ScopeIdentityIntegrity extends GateRunner {
  readonly id = "G26";
  readonly title = "Scope Identity Integrity";

  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G26.yaml"), "utf-8");
  }

  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G26.1", "unit tests pass", () => {
        execSync("pnpm --filter @orqenix/scope-identity test", { cwd: REPO_ROOT, stdio: "pipe" });
      }),

      await this.check("G26.2", "JSON schema is valid Draft-07", () => {
        const schema = JSON.parse(
          readFileSync(
            join(REPO_ROOT, "packages/scope-identity/schema/scope.schema.json"),
            "utf-8",
          ),
        );
        if (schema.$schema !== "http://json-schema.org/draft-07/schema#") {
          throw new Error("schema $schema must be Draft-07");
        }
        if (!schema.required?.includes("scopeId")) throw new Error("schema must require scopeId");
      }),

      await this.check("G26.3", "100 random scope.yaml round-trip", async () => {
        for (let i = 0; i < 100; i++) {
          const { publicKey } = await generateKeyPair();
          const yaml: ScopeYaml = {
            schemaVersion: 1,
            scopeId: deriveScopeId(publicKey),
            name: `scope-${i}-${Math.random().toString(36).slice(2, 8)}`,
            publicKey: serializePublicKey(publicKey),
            createdAt: new Date().toISOString(),
            parentScope: null,
            metadata: { tags: [`t${i}`] },
          };
          const text = serializeScopeYaml(yaml);
          const back = parseScopeYaml(text);
          if (back.scopeId !== yaml.scopeId) throw new Error(`round-trip mismatch at iter ${i}`);
        }
      }),

      await this.check("G26.4", "scopeId derivation is deterministic", async () => {
        const { publicKey } = await generateKeyPair();
        for (let i = 0; i < 50; i++) {
          if (deriveScopeId(publicKey) !== deriveScopeId(publicKey)) {
            throw new Error("non-deterministic at iter " + i);
          }
        }
      }),

      await this.check("G26.5", "50 random tampers all rejected", async () => {
        for (let i = 0; i < 50; i++) {
          const { publicKey } = await generateKeyPair();
          const yaml: ScopeYaml = {
            schemaVersion: 1,
            scopeId: deriveScopeId(publicKey),
            name: "tampered",
            publicKey: serializePublicKey(publicKey),
            createdAt: new Date().toISOString(),
            parentScope: null,
            metadata: {},
          };
          const idx = 6 + Math.floor(Math.random() * 32);
          const ch = yaml.scopeId[idx];
          const replacement = ch === "A" ? "B" : "A";
          const tampered = {
            ...yaml,
            scopeId: (yaml.scopeId.slice(0, idx) +
              replacement +
              yaml.scopeId.slice(idx + 1)) as ScopeYaml["scopeId"],
          };
          let caught = false;
          try {
            verifyScopeYamlConsistency(tampered as ScopeYaml, publicKey);
          } catch {
            caught = true;
          }
          if (!caught) throw new Error(`tamper not caught at iter ${i}`);
        }
      }),

      await this.check("G26.6", "identity.key has mode 0600 after init", async () => {
        if (IS_WIN) return; // permission bits are not enforced on Windows
        const tmp = await mkdtemp(join(tmpdir(), "g26-perm-"));
        try {
          const r = await initScope({ rootDir: tmp, name: "perm-check" });
          const s = await stat(r.identityKeyPath);
          if ((s.mode & 0o077) !== 0) {
            throw new Error(
              `identity.key has overly permissive mode: ${(s.mode & 0o777).toString(8)}`,
            );
          }
        } finally {
          await rm(tmp, { recursive: true, force: true });
        }
      }),

      await this.check("G26.7", ".gitignore excludes identity.key", async () => {
        const tmp = await mkdtemp(join(tmpdir(), "g26-gi-"));
        try {
          await initScope({ rootDir: tmp, name: "gi-check" });
          const gi = await readFile(join(tmp, ".gitignore"), "utf-8");
          if (!gi.includes(".orqenix/identity.key"))
            throw new Error("identity.key not in .gitignore");
        } finally {
          await rm(tmp, { recursive: true, force: true });
        }
      }),
    ];
  }

  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G26-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const runner = new G26ScopeIdentityIntegrity();
  const report = await runner.execute();
  runner.printSummary(report);
  process.exit(report.status === "pass" ? 0 : 1);
}

main().catch((e) => {
  console.error("G26 crashed:", e);
  process.exit(2);
});
