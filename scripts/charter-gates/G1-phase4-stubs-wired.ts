#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import consola from "consola";

interface GateCheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

class G1Phase4StubsWired {
  private checks: GateCheckResult[] = [];
  private packagesDir = "packages";

  async run(): Promise<boolean> {
    consola.start("Charter Gate G1: Phase 4 Stubs Wired\n");

    // Check 1: Workspace structure
    this.check("Workspace structure", () => {
      const required = ["pnpm-workspace.yaml", "turbo.json", "tsconfig.base.json"];
      const missing = required.filter((f) => !existsSync(f));
      if (missing.length > 0) throw new Error(`Missing: ${missing.join(", ")}`);
    });

    // Check 2: All packages discovered
    this.check("Package discovery", () => {
      const packages = this.discoverPackages();
      if (packages.length < 10) throw new Error(`Expected >= 10 packages, found ${packages.length}`);
    });

    // Check 3: All manifests valid
    this.check("Manifest validation", () => {
      const packages = this.discoverPackages();
      const invalid = packages.filter((p) => {
        const required = ["name", "version", "license"];
        return required.some((f) => !p.manifest[f]);
      });
      if (invalid.length > 0) throw new Error(`Invalid manifests: ${invalid.map((p) => p.name).join(", ")}`);
    });

    // Check 4: Required files present
    this.check("Required files", () => {
      const packages = this.discoverPackages();
      const missing: string[] = [];
      for (const pkg of packages) {
        const req = ["src/index.ts", "tsconfig.json", "package.json"];
        for (const f of req) {
          if (!existsSync(join(pkg.path, f))) missing.push(`${pkg.name}: ${f}`);
        }
      }
      if (missing.length > 0) throw new Error(`Missing files: ${missing.slice(0, 5).join("; ")}`);
    });

    // Check 5: Core builds
    this.check("@orqenix/core builds", () => {
      execSync("pnpm --filter @orqenix/core build", { stdio: "pipe", encoding: "utf-8" });
    });

    // Check 6: Core tests pass
    this.check("@orqenix/core tests pass", () => {
      const out = execSync("pnpm --filter @orqenix/core test", { stdio: "pipe", encoding: "utf-8" });
      if (!out.includes("passed")) throw new Error("Tests did not pass");
    });

    // Check 7: Phase 5 readiness metadata exists
    this.check("Phase 5 metadata", () => {
      if (!existsSync("packages/_meta/phase-5-readiness.ts")) {
        throw new Error("packages/_meta/phase-5-readiness.ts not found");
      }
    });

    // Summary
    const passed = this.checks.filter((c) => c.pass).length;
    const total = this.checks.length;
    consola.info(`\nGate G1: ${passed}/${total} checks passed`);

    for (const c of this.checks) {
      const icon = c.pass ? "✓" : "✗";
      consola.info(`  ${icon} ${c.name}: ${c.detail}`);
    }

    return passed === total;
  }

  private check(name: string, fn: () => void): void {
    try {
      fn();
      this.checks.push({ name, pass: true, detail: "OK" });
    } catch (err: any) {
      this.checks.push({ name, pass: false, detail: err.message });
    }
  }

  private discoverPackages(): Array<{ name: string; path: string; manifest: Record<string, unknown> }> {
    if (!existsSync(this.packagesDir)) return [];
    return readdirSync(this.packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
      .map((e) => {
        const pkgPath = join(this.packagesDir, e.name);
        const mPath = join(pkgPath, "package.json");
        if (!existsSync(mPath)) return null;
        try {
          const manifest = JSON.parse(readFileSync(mPath, "utf-8"));
          return { name: manifest.name || e.name, path: pkgPath, manifest };
        } catch { return null; }
      })
      .filter((p) => p !== null) as Array<{ name: string; path: string; manifest: Record<string, unknown> }>;
  }
}

const gate = new G1Phase4StubsWired();
gate.run().then((passed) => process.exit(passed ? 0 : 1)).catch(() => process.exit(2));
