#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const log = {
  start: (message: string) => console.log(message),
  info: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
};

interface Phase4Package {
  name: string;
  path: string;
  manifest: Record<string, unknown>;
}

interface CheckResult {
  pkg: string;
  check: string;
  passed: boolean;
  duration: number;
  details?: string;
}

class Phase4StubVerifier {
  private results: CheckResult[] = [];

  async run(): Promise<boolean> {
    log.start("Phase 4 Stub Wiring Verification\n");

    const packages = this.discoverPackages();
    log.info(`Found ${packages.length} packages\n`);

    for (const pkg of packages) {
      await this.verifyPackage(pkg);
    }

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    log.info(`\nResults: ${passed}/${total} checks passed`);

    const failedPackages = new Set(this.results.filter((r) => !r.passed).map((r) => r.pkg));
    if (failedPackages.size > 0) {
      log.error(`Failed packages: ${Array.from(failedPackages).join(", ")}`);
    }

    return passed === total;
  }

  private discoverPackages(): Phase4Package[] {
    const packagesDir = "packages";
    if (!existsSync(packagesDir)) return [];

    return readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
      .map((e) => {
        const pkgPath = join(packagesDir, e.name);
        const manifestPath = join(pkgPath, "package.json");
        if (!existsSync(manifestPath)) return null;
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          return { name: manifest.name || e.name, path: pkgPath, manifest };
        } catch {
          return null;
        }
      })
      .filter((p): p is Phase4Package => p !== null);
  }

  private async verifyPackage(pkg: Phase4Package): Promise<void> {
    this.recordCheck(pkg.name, "manifest", () => this.checkManifest(pkg));
    this.recordCheck(pkg.name, "required files", () => this.checkRequiredFiles(pkg));
  }

  private recordCheck(
    pkgName: string,
    checkName: string,
    fn: () => { passed: boolean; details?: string },
  ): void {
    const start = performance.now();
    try {
      const { passed, details } = fn();
      const duration = performance.now() - start;
      this.results.push({ pkg: pkgName, check: checkName, passed, duration, details });
      const icon = passed ? "✓" : "✗";
      log.info(
        `  ${icon} [${passed ? "PASS" : "FAIL"}] ${pkgName} :: ${checkName} (${duration.toFixed(0)}ms)`,
      );
    } catch (err) {
      this.results.push({
        pkg: pkgName,
        check: checkName,
        passed: false,
        duration: 0,
        details: String(err),
      });
      log.info(`  ✗ [ERROR] ${pkgName} :: ${checkName}: ${err}`);
    }
  }

  private checkManifest(pkg: Phase4Package): { passed: boolean; details?: string } {
    const required = ["name", "version", "license", "type"];
    const missing = required.filter((f) => !pkg.manifest[f]);
    if (missing.length > 0) return { passed: false, details: `Missing: ${missing.join(", ")}` };
    return { passed: true };
  }

  private checkRequiredFiles(pkg: Phase4Package): { passed: boolean; details?: string } {
    const required = ["src/index.ts", "tsconfig.json", "package.json"];
    const missing = required.filter((f) => !existsSync(join(pkg.path, f)));
    if (missing.length > 0) return { passed: false, details: `Missing: ${missing.join(", ")}` };
    return { passed: true };
  }
}

const verifier = new Phase4StubVerifier();
verifier
  .run()
  .then((passed) => process.exit(passed ? 0 : 1))
  .catch(() => process.exit(2));
