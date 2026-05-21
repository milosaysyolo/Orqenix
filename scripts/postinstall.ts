/**
 * Lightweight postinstall: warn if Node < 20, otherwise no-op.
 * Real distribution work happens in Phase 7.
 */
const [major] = process.versions.node.split(".").map(Number);
if (typeof major === "number" && major < 20) {
  console.error(
    `[orqenix] Node ${process.versions.node} is unsupported. Please use Node 20 LTS or later.`,
  );
  process.exit(1);
}
