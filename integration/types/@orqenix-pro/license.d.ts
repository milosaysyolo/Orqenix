declare module '@orqenix-pro/license' {
  export type Plan = 'pro' | 'team' | 'enterprise'

  export interface LicensePayload {
    customerId: string
    plan: Plan
    issuedAt: number
    expiresAt: number
    features: string[]
  }

  export interface License extends LicensePayload {
    signature: string
  }

  export type InvalidReason =
    | 'signature-invalid'
    | 'expired-beyond-grace'
    | 'not-yet-valid'
    | 'malformed'

  export interface LicenseCheckValid {
    valid: true
    inGrace: boolean
    graceRemainingMs: number
  }

  export interface LicenseCheckInvalid {
    valid: false
    reason: InvalidReason
  }

  export type LicenseCheckResult = LicenseCheckValid | LicenseCheckInvalid

  export interface VerifyOptions {
    publicKeyPath: string
    now?: number
    gracePeriodMs?: number
  }

  export function signLicense(payload: LicensePayload, privateKeyPath: string): Promise<License>
  export function canonicalize(payload: LicensePayload): string
  export function verifyLicense(lic: unknown, opts: VerifyOptions): Promise<LicenseCheckResult>
  export function hasFeature(lic: License, feature: string): boolean
  export function loadLicense(path: string): License

  export const GRACE_PERIOD_MS: number

  export class ProLicenseVerifier {
    constructor(opts: { publicKeyPath?: string })
    verify(license: unknown): Promise<LicenseCheckResult>
  }
}
