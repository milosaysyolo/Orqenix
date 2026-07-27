import { parseArgs } from "node:util";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadTransportsConfig, loadBootstrapFile } from "./config.js";
import { loadPeersYaml, AddressBook } from "./address-book.js";
import { loadLocalIdentity } from "./identity-loader.js";
import { startLocalNode, type LocalNodeRuntime } from "./node.js";
import type { MeshRequest, MeshResponse, TransportCtx } from "@orqenix/mesh-transport-core";

const HERE = dirname(fileURLToPath(import.meta.url));

interface CliArgs {
  cmd: "start" | "status" | "verify" | "version" | "help";
  configDir: string;
}

export function parseCli(argv: string[]): CliArgs {
  const cmd = (argv[0] ?? "help") as CliArgs["cmd"];
  const rest = argv.slice(1);
  const { values } = parseArgs({
    args: rest,
    options: {
      config: { type: "string", short: "c" },
    },
    allowPositionals: true,
  });
  const configDir = values.config ?? ".orqenix";
  if (!["start", "status", "verify", "version", "help"].includes(cmd)) {
    return { cmd: "help", configDir };
  }
  return { cmd, configDir };
}

async function runStart(configDir: string): Promise<void> {
  const transportsPath = join(configDir, "mesh", "transports.yaml");
  const bootstrapPath = join(configDir, "mesh", "bootstrap.yaml");
  const peersPath = join(configDir, "mesh", "peers.yaml");
  const scopePath = join(configDir, "identity", "scope.yaml");
  const privatePath = join(configDir, "identity", "private.pem");

  const config = await loadTransportsConfig(transportsPath);
  let bootstrap;
  try {
    bootstrap = await loadBootstrapFile(bootstrapPath);
  } catch {
    /* optional */
  }
  let addressBook = new AddressBook();
  try {
    addressBook = await loadPeersYaml(peersPath);
  } catch {
    /* optional */
  }
  const identity = await loadLocalIdentity(scopePath, privatePath);

  const handler = async (req: MeshRequest, _ctx: TransportCtx): Promise<MeshResponse> => ({
    id: req.id,
    status: "ok",
    payload: req.payload,
  });

  const runtime: LocalNodeRuntime = await startLocalNode({
    identity,
    config,
    bootstrap,
    addressBook,
    handler,
  });

  const log = (msg: string) => process.stdout.write(`${msg}\n`);

  log(`[orqenix-node] started scope=${identity.scopeId}`);
  const status = runtime.status();
  for (const t of status.transports) {
    for (const a of t.addresses) log(`[orqenix-node] listening on ${t.kind} ${a}`);
  }

  const shutdown = async (signal: string) => {
    log(`[orqenix-node] received ${signal}; stopping...`);
    try {
      await runtime.stop();
    } catch {
      /* ignore */
    }
    log("[orqenix-node] stopped");
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await new Promise(() => undefined);
}

async function runStatus(configDir: string): Promise<void> {
  const transportsPath = join(configDir, "mesh", "transports.yaml");
  const scopePath = join(configDir, "identity", "scope.yaml");
  const privatePath = join(configDir, "identity", "private.pem");
  const config = await loadTransportsConfig(transportsPath);
  const identity = await loadLocalIdentity(scopePath, privatePath);
  const addressBook = new AddressBook();
  const handler = async (req: MeshRequest) => ({ id: req.id, status: "ok" as const });
  const runtime = await startLocalNode({ identity, config, addressBook, handler });
  process.stdout.write(JSON.stringify(runtime.status(), null, 2) + "\n");
  await runtime.stop();
}

async function runVerify(): Promise<void> {
  const verifyScript = join(HERE, "..", "..", "..", "scripts", "gates", "verify-phase-6.ts");
  const child = spawn(process.execPath, ["--import", "tsx", verifyScript], { stdio: "inherit" });
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`verify-phase-6 exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

function runVersion(): void {
  process.stdout.write("orqenix-node 0.6.0-phase-6\n");
}

function runHelp(): void {
  process.stdout.write(
    [
      "orqenix-node 0.6.0-phase-6",
      "",
      "Usage:",
      "  orqenix-node start   [--config <dir>]",
      "  orqenix-node status  [--config <dir>]",
      "  orqenix-node verify",
      "  orqenix-node version",
      "",
    ].join("\n"),
  );
}

export async function runCli(argv: string[]): Promise<void> {
  const args = parseCli(argv);
  switch (args.cmd) {
    case "start":
      return runStart(args.configDir);
    case "status":
      return runStatus(args.configDir);
    case "verify":
      return runVerify();
    case "version":
      runVersion();
      return;
    case "help":
    default:
      runHelp();
      return;
  }
}

const isMain =
  process.argv[1] && (process.argv[1].endsWith("cli.ts") || process.argv[1].endsWith("cli.js"));
if (isMain) {
  runCli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`[orqenix-node] error: ${(e as Error).message}\n`);
    process.exit(1);
  });
}
