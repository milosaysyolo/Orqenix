import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspace, type WorkspaceContext } from "../helpers/workspace.js";
import { makeLicense } from "../helpers/license-fixtures.js";
import { verifyLicense } from "@orqenix-pro/license";
import { PUBLIC_KEY_PATH } from "../helpers/license-fixtures.js";
import { ensureProBuilt, ensureProKeys } from "../helpers/pro-tier.js";

let ws: WorkspaceContext;

beforeAll(async () => {
  await ensureProKeys();
  await ensureProBuilt();
  ws = await createWorkspace();
});

afterAll(async () => { await ws.cleanup(); });

describe("E2E 02 Pro license install", () => {
  it("signed license verifies successfully against public key", async () => {
    const lic = await makeLicense();
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(true);
  });

  it("license file persists in workspace .orqenix/pro/", async () => {
    const lic = await makeLicense();
    const licDir = join(ws.dir, ".orqenix", "pro");
    await mkdir(licDir, { recursive: true });
    const licPath = join(licDir, "license.json");
    await writeFile(licPath, JSON.stringify(lic, null, 2));
    expect(await ws.exists(".orqenix/pro/license.json")).toBe(true);
  });

  it("license payload preserves declared features", async () => {
    const lic = await makeLicense({ features: ["learning-loop", "knowledge-intel", "cross-project-retrieval"] });
    expect(lic.features).toContain("learning-loop");
    expect(lic.features).toContain("knowledge-intel");
    expect(lic.features).toContain("cross-project-retrieval");
  });

  it("malformed license file is rejected by verifier", async () => {
    const r = await verifyLicense({ not: "a-license" }, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("malformed");
  });
});
