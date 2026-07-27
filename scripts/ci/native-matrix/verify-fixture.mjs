// scripts/ci/native-matrix/verify-fixture.mjs
// Standalone BLAKE3 fixture verifier for CI.
// Loads the pinned fixture and verifies blake3-wasm reproduces the expected digest.
// Exits 0 on OK, 1 on mismatch.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

async function main() {
  const fx = JSON.parse(readFileSync(join(FIXTURES, "blake3-known.json"), "utf8"));
  const expected = fx.expected_hex;
  if (typeof expected !== "string" || expected.length !== 64 || !/^[0-9a-f]+$/.test(expected)) {
    console.error("FIXTURE FAIL: malformed expected_hex in fixture");
    process.exit(1);
  }

  let blake3;
  try {
    blake3 = await import("blake3-wasm");
  } catch (e) {
    console.error("FIXTURE FAIL: blake3-wasm import error:", e.message);
    process.exit(1);
  }

  const msg = Buffer.from(fx.input_utf8);
  const out = blake3.hash(msg);
  const digestHex = Buffer.from(out).toString("hex");

  if (digestHex !== expected) {
    console.error(`FIXTURE FAIL: digest mismatch. expected=${expected} got=${digestHex}`);
    process.exit(1);
  }

  console.log(`FIXTURE OK: blake3-wasm digest matches fixture (${digestHex.slice(0, 16)}...)`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FIXTURE FAIL:", e.message);
  process.exit(1);
});
