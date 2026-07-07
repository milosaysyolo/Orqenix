#!/usr/bin/env node
import { runCli } from "../dist/cli.js";
runCli(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`[orqenix-node] error: ${e && e.message ? e.message : String(e)}\n`);
  process.exit(1);
});
