import { describe, it, expect } from "vitest";
import { makeLicense, makeExpiredLicense } from "../helpers/license-fixtures.js";
import { verifyLicense, GRACE_PERIOD_MS } from "@orqenix-pro/license";
import { PUBLIC_KEY_PATH } from "../helpers/license-fixtures.js";

describe("E2E 04 license grace transitions", () => {
  it("active license is not in grace", async () => {
    const lic = await makeLicense({ expiresInDays: 30 });
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.inGrace).toBe(false);
  });

  it("expired 1 day reports inGrace with remaining > 0", async () => {
    const lic = await makeExpiredLicense(1);
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.inGrace).toBe(true);
      expect(r.graceRemainingMs).toBeGreaterThan(0);
      expect(r.graceRemainingMs).toBeLessThanOrEqual(GRACE_PERIOD_MS);
    }
  });

  it("expired 6 days remains in grace", async () => {
    const lic = await makeExpiredLicense(6);
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.inGrace).toBe(true);
  });

  it("expired 8 days exceeds grace", async () => {
    const lic = await makeExpiredLicense(8);
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("expired-beyond-grace");
  });

  it("clock advance moves license from active to grace to invalid", async () => {
    const start = Date.now();
    const lic = await makeLicense({ issuedDaysAgo: 30, expiresInDays: 1 });
    const nowActive = start;
    const nowGrace = start + 2 * 86400000;
    const nowExpired = start + 10 * 86400000;

    const rActive = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH, now: nowActive });
    expect(rActive.valid).toBe(true);

    const rGrace = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH, now: nowGrace });
    expect(rGrace.valid).toBe(true);
    if (rGrace.valid) expect(rGrace.inGrace).toBe(true);

    const rExpired = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH, now: nowExpired });
    expect(rExpired.valid).toBe(false);
  });

  it("not-yet-valid license is rejected", async () => {
    const lic = await makeLicense({ issuedDaysAgo: -2, expiresInDays: 30 });
    const r = await verifyLicense(lic, { publicKeyPath: PUBLIC_KEY_PATH });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("not-yet-valid");
  });
});
