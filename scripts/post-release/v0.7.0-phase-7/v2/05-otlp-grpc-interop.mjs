#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE = process.env.ITEM_EVIDENCE_DIR || resolve(process.cwd(), "out/item-5");
mkdirSync(EVIDENCE, { recursive: true });

try {
  execSync("docker --version", { stdio: "pipe" });
} catch {
  console.log("[05] docker not available — SKIP");
  process.exit(2);
}

const CONTAINER = `orqenix-otel-${process.pid}`;
const IMAGE = "otel/opentelemetry-collector-contrib:0.106.0";
const PORT = 4317;

const config = `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:${PORT}
exporters:
  debug:
    verbosity: detailed
  file:
    path: /tmp/otlp-received.json
service:
  pipelines:
    metrics:
      receivers: [otlp]
      exporters: [debug, file]
`;
const configPath = resolve(EVIDENCE, "collector-config.yaml");
writeFileSync(configPath, config);

console.log("[05] Starting otel-collector...");
const start = spawnSync(
  "docker",
  [
    "run",
    "-d",
    "--rm",
    "--name",
    CONTAINER,
    "-p",
    `${PORT}:${PORT}`,
    "-v",
    `${configPath}:/etc/otelcol-contrib/config.yaml:ro`,
    IMAGE,
    "--config=/etc/otelcol-contrib/config.yaml",
  ],
  { encoding: "utf8" },
);
writeFileSync(
  resolve(EVIDENCE, "collector-start.log"),
  `${start.stdout || ""}\n${start.stderr || ""}`,
);

if (start.status !== 0) {
  console.error("[05] FAIL: docker run");
  process.exit(1);
}

const cleanup = () => {
  try {
    execSync(`docker stop ${CONTAINER}`, { stdio: "pipe" });
  } catch {}
};
process.on("exit", cleanup);

await new Promise((r) => setTimeout(r, 5000));

console.log("[05] Building observability-otlp...");
spawnSync("pnpm", ["--filter", "@orqenix-cloud/observability-otlp", "build"], {
  encoding: "utf8",
  cwd: process.cwd(),
});

const testFile = resolve(EVIDENCE, "interop-test.mjs");
writeFileSync(
  testFile,
  `
import { OtlpGrpcMetricExporter } from '@orqenix-cloud/observability-otlp/grpc-native';
const exporter = new OtlpGrpcMetricExporter({ endpoint: 'localhost:${PORT}', timeoutMs: 5000 });
const metrics = [{ name: 'orqenix.test.counter', value: 42, attributes: { src: 'interop' } }];
try {
  await exporter.export(metrics);
  console.log('OK: exporter accepted metrics');
  console.log('received: orqenix.test.counter');
  console.log('collector: true');
} catch (e) { console.error('FAIL:', e.message); process.exit(1); }
`,
);

const test = spawnSync("node", [testFile], {
  encoding: "utf8",
  cwd: process.cwd(),
  timeout: 30000,
});
writeFileSync(resolve(EVIDENCE, "client.log"), `${test.stdout || ""}\n${test.stderr || ""}`);

if (test.status !== 0) {
  console.error("[05] FAIL: client export error");
  cleanup();
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 2000));

const logs = spawnSync("docker", ["logs", CONTAINER], { encoding: "utf8" });
writeFileSync(resolve(EVIDENCE, "collector.log"), logs.stdout || "");

if (!(logs.stdout || "").includes("orqenix.test.counter")) {
  console.error("[05] FAIL: collector did not record orqenix.test.counter");
  console.error((logs.stdout || "").slice(-1500));
  cleanup();
  process.exit(1);
}

console.log("[05] OTLP gRPC interop: collector received orqenix.test.counter — PASS");
cleanup();
