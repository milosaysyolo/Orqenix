// scripts/ci/native-matrix/smoke.mjs
// Native binding smoke for Orqenix Phase 6 CI matrix.
// Exits 0 on success; non-zero on first failure with a clear one-line cause.
// Verifies: better-sqlite3 (WAL + insert/select), blake3-wasm (known digest),
// sqlite-vec (vec0 dim=384 nearest-neighbor ordering).

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

function ok(name, ms, detail = "") {
  console.log(`[smoke] PASS  ${name}  (${ms.toFixed(1)}ms${detail ? `, ${detail}` : ""})`);
}
function fail(name, err) {
  console.error(`[smoke] FAIL  ${name}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

async function smokeBetterSqlite3() {
  const t0 = performance.now();
  let Database;
  try {
    ({ default: Database } = await import("better-sqlite3"));
  } catch (e) {
    fail("better-sqlite3 import", e);
  }

  const dir = mkdtempSync(join(tmpdir(), "orqenix-smoke-bs3-"));
  const path = join(dir, "smoke.db");
  let db;
  try {
    db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    const mode = db.pragma("journal_mode", { simple: true });
    if (String(mode).toLowerCase() !== "wal") {
      throw new Error(`journal_mode expected wal, got ${mode}`);
    }

    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL) STRICT");
    const insert = db.prepare("INSERT INTO t (id, name) VALUES (?, ?)");
    const rows = [
      [1, "alpha"],
      [2, "bravo"],
      [3, "charlie"],
    ];
    const tx = db.transaction((items) => {
      for (const r of items) insert.run(r[0], r[1]);
    });
    tx(rows);

    const all = db.prepare("SELECT id, name FROM t ORDER BY id").all();
    if (all.length !== 3 || all[2].name !== "charlie") {
      throw new Error(`select mismatch: ${JSON.stringify(all)}`);
    }
  } finally {
    try {
      db && db.close();
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true });
  }
  ok("better-sqlite3", performance.now() - t0);
}

async function smokeBlake3() {
  const t0 = performance.now();
  let blake3;
  try {
    blake3 = await import("blake3-wasm");
  } catch (e) {
    fail("blake3-wasm import", e);
  }

  // Load expected digest fixture.
  let expected;
  try {
    const fx = JSON.parse(readFileSync(join(FIXTURES, "blake3-known.json"), "utf8"));
    expected = fx.expected_hex;
    if (typeof expected !== "string" || expected.length !== 64 || !/^[0-9a-f]+$/.test(expected)) {
      throw new Error("fixture expected_hex malformed");
    }
  } catch (e) {
    fail("blake3 fixture load", e);
  }

  const msg = Buffer.from("orqenix-phase-6-native-matrix");
  let digestHex;
  try {
    const out = blake3.hash(msg);
    digestHex = Buffer.from(out).toString("hex");
  } catch (e) {
    fail("blake3-wasm hash", e);
  }

  if (digestHex !== expected) {
    fail("blake3-wasm digest", new Error(`expected=${expected} got=${digestHex}`));
  }
  ok("blake3-wasm", performance.now() - t0, `digest matches fixture`);
}

async function smokeSqliteVec() {
  const t0 = performance.now();
  let Database;
  let sqliteVec;
  try {
    ({ default: Database } = await import("better-sqlite3"));
    sqliteVec = await import("sqlite-vec");
  } catch (e) {
    fail("sqlite-vec import", e);
  }

  const dir = mkdtempSync(join(tmpdir(), "orqenix-smoke-vec-"));
  const path = join(dir, "smoke.db");
  let db;
  try {
    db = new Database(path);
    sqliteVec.load(db);

    db.exec("CREATE VIRTUAL TABLE v USING vec0(embedding float[384])");

    // Build 4 deterministic vectors: v1 is the query target; others are increasingly far.
    const DIM = 384;
    const mk = (seed) => {
      const arr = new Float32Array(DIM);
      for (let i = 0; i < DIM; i++) arr[i] = ((i + seed) % 17) * 0.01;
      return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    };
    const query = mk(0);
    const v1 = mk(0); // identical to query (distance 0)
    const v2 = mk(1);
    const v3 = mk(5);
    const v4 = mk(13);

    const insert = db.prepare("INSERT INTO v (rowid, embedding) VALUES (?, ?)");
    insert.run(1, v1);
    insert.run(2, v2);
    insert.run(3, v3);
    insert.run(4, v4);

    const top = db
      .prepare(
        `
      SELECT rowid, distance
      FROM v
      WHERE embedding MATCH ? AND k = 2
      ORDER BY distance
    `,
      )
      .all(query);

    if (top.length !== 2) {
      throw new Error(`expected 2 rows, got ${top.length}`);
    }
    if (top[0].rowid !== 1) {
      throw new Error(`nearest expected rowid=1, got ${top[0].rowid}`);
    }
    if (top[1].rowid !== 2) {
      throw new Error(`second nearest expected rowid=2, got ${top[1].rowid}`);
    }
  } finally {
    try {
      db && db.close();
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true });
  }
  ok("sqlite-vec", performance.now() - t0, `top-2 ordering verified`);
}

async function main() {
  const start = performance.now();
  console.log(`[smoke] node=${process.version} platform=${process.platform} arch=${process.arch}`);

  await smokeBetterSqlite3();
  await smokeBlake3();
  await smokeSqliteVec();

  const total = performance.now() - start;
  console.log(`[smoke] ALL PASS in ${total.toFixed(1)}ms`);
}

main().catch((e) => {
  fail("main", e);
});
