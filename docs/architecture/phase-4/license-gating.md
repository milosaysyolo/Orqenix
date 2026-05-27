# License Gating, BSL 1.1 Boundary

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 1.1 (Identity), Chapter 14 (Marketplace).
> Owner: Milo, orqenix.

## 1. License tiers

Orqenix ships in three tiers, each under a distinct license:

- Core: Apache 2.0, free forever, no feature gating
- Pro: BSL 1.1, converts to Apache 2.0 on 2030-01-01, paid
- Cloud: Proprietary, managed service, paid per usage

The boundary is enforced in two ways: a hard repo boundary (Pro code lives in
the separate `Orqenix-Pro` repo) and a runtime feature flag check.

## 2. Pro feature gating

### 2.1 Feature flag scheme

Every Pro feature carries a string flag, listed in the license payload's
`features` array:

- `learning-loop`
- `knowledge-intel`
- `cross-project-retrieval`
- `decision-graph-traversal`
- `embedded-marketplace`

A feature is available if and only if the verified license includes its flag.

### 2.2 Runtime check

```ts
import { hasFeature } from "@orqenix-pro/license";

if (!hasFeature(license, "learning-loop")) {
  throw new Error("learning-loop requires a Pro license");
}
```

The check is mandatory at the entry point of every Pro module. Bypassing it
is a contract violation, not a soft warning.

## 3. Grace period

### 3.1 Why

Users on a trial, a billing hiccup, or a key rotation should not lose access
the moment their license expires. The 7-day grace period gives ops the time
to fix the issue.

### 3.2 Mechanics

* Constant `GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000`
* During grace, `verifyLicense` returns `{ valid: true, inGrace: true, graceRemainingMs }`
* The CLI emits a warning on every invocation during grace
* After grace, `verifyLicense` returns `{ valid: false, reason: "expired-beyond-grace" }`

### 3.3 No silent extension

The grace period does not extend on each check. It is anchored to
`expiresAt + GRACE_PERIOD_MS`. There is no clock to game.

## 4. Cryptographic design

### 4.1 Ed25519 keypair

* Private key: generated once, kept on the issuance server, never exported
* Public key: shipped in the Pro binary as a PEM string

Ed25519 was chosen for compactness, speed, and standard library support in
Node.js without external dependencies.

### 4.2 Canonical payload

Signature covers the canonical JSON of the payload, sorted features:

```ts
function canonicalize(payload) {
  return JSON.stringify({
    customerId: payload.customerId,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    features: [...payload.features].sort(),
  });
}
```

Sorting features makes two payloads with the same content but different
input order produce identical signatures. This matters for license re-issue
and for testing.

### 4.3 Storage

A license file is JSON with the payload fields plus a `signature` field
(base64-encoded). It is suitable for:

* Email delivery to the customer
* Storage in a secrets manager
* Mounting as a file in containerized deployments

## 5. License issuance API

In Phase 4, issuance is manual: a CLI script signs payloads using the
private key. Phase 5 introduces a hosted issuance API with:

* Audit log of every issuance
* Revocation list (signed, cached, refreshed)
* Self-serve renewal for paying customers

## 6. Anti-tamper

* Public key is embedded in the Pro binary at build time, not loaded from
  disk
* Modifying the binary to bypass verification triggers an integrity check on
  startup
* Mismatched signature attempts are logged with full payload for forensics

## 7. Audit trail

Every license check writes a structured log entry:

* timestamp
* result (valid, invalid, in-grace)
* customerId
* features attempted
* caller (module path)

The log is local; it is not phoned home. Enterprise customers can ship the
log to their SIEM via standard log forwarding.

## 8. Boundary enforcement

### 8.1 Repository boundary

Pro code lives only in `Orqenix-Pro`. The OSS repo `Orqenix` never imports
from `@orqenix-pro/*`. CI enforces this with a static check:

```bash
grep -rIn "@orqenix-pro/" packages/ && exit 1 || exit 0
```

### 8.2 Distribution boundary

OSS packages publish to npm under `@orqenix/*`. Pro packages publish under
`@orqenix-pro/*`. Cloud-only modules never publish.

### 8.3 BSL 1.1 obligations

Under BSL 1.1, the Licensed Work may be used for non-production evaluation,
internal development, and testing. Production use requires a commercial
license. On 2030-01-01, the Change Date, the Licensed Work converts to
Apache 2.0 automatically.

## 9. Customer experience

### 9.1 First install

User receives an email with `license.json`. The CLI provides:

```bash
orqenix pro install ./license.json
```

The CLI verifies, prints features unlocked, exits 0.

### 9.2 Expiry warning

7 days before expiry, the CLI prints a warning on every invocation. The
warning links to the renewal page.

### 9.3 In-grace experience

Pro features still work; CLI prints `[license in grace, N hours remaining]`.
No nag, just an honest status line.

### 9.4 Post-grace

Pro features refuse to start with a clear error message that explains how to
renew or downgrade to OSS.

## 10. Threat model

* Stolen license file: replayable on any machine; future hardware binding in
  Phase 5
* Reverse-engineered binary: difficult without source, possible with effort;
  acceptable risk for current tier
* Cracked verification: detected by checksum mismatch on the public key
* Insider abuse: covered by audit log and revocation list

## 11. Open questions for Phase 5

* Hardware binding via TPM or platform identity
* Online license check with offline fallback
* Per-seat enforcement for team licenses
* Customer-facing usage dashboard
