import { signLicense, type LicensePayload } from "@orqenix-pro/license";
import { join } from "node:path";
import { PRO_ROOT } from "./workspace.js";

export const PRIVATE_KEY_PATH = join(PRO_ROOT, "keys", "test-private.pem");
export const PUBLIC_KEY_PATH = join(PRO_ROOT, "keys", "test-public.pem");

export interface FixtureOptions {
  customerId?: string;
  plan?: "pro" | "team" | "enterprise";
  features?: string[];
  expiresInDays?: number;
  issuedDaysAgo?: number;
}

export async function makeLicense(opts: FixtureOptions = {}) {
  const now = Date.now();
  const payload: LicensePayload = {
    customerId: opts.customerId ?? "integration-test",
    plan: opts.plan ?? "pro",
    issuedAt: now - (opts.issuedDaysAgo ?? 10) * 86400000,
    expiresAt: now + (opts.expiresInDays ?? 30) * 86400000,
    features: opts.features ?? ["learning-loop", "knowledge-intel"],
  };
  return signLicense(payload, PRIVATE_KEY_PATH);
}

export async function makeExpiredLicense(daysExpired: number, features = ["learning-loop"]) {
  return makeLicense({
    features,
    issuedDaysAgo: 60,
    expiresInDays: -daysExpired,
  });
}
