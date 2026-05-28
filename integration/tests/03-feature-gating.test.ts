import { describe, it, expect } from "vitest";
import { makeLicense } from "../helpers/license-fixtures.js";
import { verifyLicense, hasFeature } from "@orqenix-pro/license";
import { PUBLIC_KEY_PATH } from "../helpers/license-fixtures.js";

describe("E2E 03 Pro feature gating", () => {
  it("hasFeature returns true for licensed feature", async () => {
    const lic = await makeLicense({ features: ["learning-loop"] });
    expect(hasFeature(lic, "learning-loop")).toBe(true);
  });

  it("hasFeature returns false for unlicensed feature", async () => {
    const lic = await makeLicense({ features: ["learning-loop"] });
    expect(hasFeature(lic, "cloud-only-feature")).toBe(false);
  });

  it("enterprise plan retains all listed features", async () => {
    const lic = await makeLicense({ plan: "enterprise", features: ["learning-loop", "knowledge-intel", "embedded-marketplace"] });
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(true);
    expect(hasFeature(lic, "embedded-marketplace")).toBe(true);
  });

  it("downgraded plan does not implicitly grant features", async () => {
    const proLic = await makeLicense({ plan: "pro", features: ["learning-loop"] });
    expect(hasFeature(proLic, "knowledge-intel")).toBe(false);
  });
});
