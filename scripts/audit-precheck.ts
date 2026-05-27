import { execa } from "execa";

interface AuditAdvisory {
  severity: "low" | "moderate" | "high" | "critical";
  module_name: string;
}

interface AuditResult {
  advisories?: Record<string, AuditAdvisory>;
  metadata?: {
    vulnerabilities: {
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
  };
}

async function main() {
  const { stdout, exitCode } = await execa(
    "pnpm",
    ["audit", "--json", "--audit-level=high"],
    { reject: false }
  );

  let result: AuditResult;
  try {
    result = JSON.parse(stdout);
  } catch {
    console.error("Could not parse pnpm audit output");
    console.error(stdout);
    process.exit(1);
  }

  const vulns = result.metadata?.vulnerabilities ?? {
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };

  console.log(
    `audit summary: low=${vulns.low} moderate=${vulns.moderate} high=${vulns.high} critical=${vulns.critical}`
  );

  if (vulns.high > 0 || vulns.critical > 0) {
    console.error("FAIL: high or critical vulnerabilities present");
    if (result.advisories) {
      for (const [, adv] of Object.entries(result.advisories)) {
        if (adv.severity === "high" || adv.severity === "critical") {
          console.error(`  [${adv.severity}] ${adv.module_name}`);
        }
      }
    }
    process.exit(1);
  }

  console.log("PASS: no high or critical CVE");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
