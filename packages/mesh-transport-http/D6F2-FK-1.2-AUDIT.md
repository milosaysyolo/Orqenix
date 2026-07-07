# FK-1.2 Audit: HttpMeshTransport refactor + FK-1 axes verification

**Date:** 2026-06-09
**Agent:** build agent
**FK Spec:** D6F2 Section FK-1.2

## Phase 1: Pre-flight raw output

```
===== FK-1.2 PRE-FLIGHT AUDIT =====

----- Check 1: mode flag existence -----
(empty - no mode flag found)

----- Check 2: Header prefix -----
X-Orqenix-* occurrences: 18 (HDR.CAPABILITY, HDR.SCOPE_SIG, etc.)
X-Mesh-* occurrences: 0

----- Check 3: Signing payload -----
request.id.toScope pattern: this.sign(req.id, req.toScope) at transport.ts:225
No createHash/sha256/hash.body found

----- Check 4: Identity injection -----
@orqenix/crypto imports: 0
IdentityVerifier interface with verifyScopeSig in identity.ts
SignFn type in identity.ts

----- Check 5: msgpack lib -----
deps: msgpackr ^1.11.0 (correct)
No @msgpack/msgpack found

----- Check 6: Structural typing -----
No @orqenix/transport-security imports in src/ files

----- Check 7: Single class evidence -----
onRequest declared at transport.ts:124
async send(target: MeshAddress...) at transport.ts:219
Both present, no mode gating
```

## Phase 2: Decision matrix

| Axis                  | Spec target                               | Current state                    | Action |
| --------------------- | ----------------------------------------- | -------------------------------- | ------ |
| 1. Headers prefix     | All X-Orqenix-\*                          | 18 occurrences, 0 X-Mesh-\*      | KEEP   |
| 2. Signing payload    | UTF-8(`${request.id}.${toScope}`)         | `this.sign(req.id, req.toScope)` | KEEP   |
| 3. Identity injection | IdentityVerifier + SignFn via constructor | Yes, both via constructor opts   | KEEP   |
| 4. Msgpack lib        | msgpackr only                             | msgpackr ^1.11.0 only            | KEEP   |
| 5. Unified class      | Both methods active                       | onRequest + send, no mode flag   | KEEP   |

All 5 axes show KEEP. No Phase 3 changes needed.

## Phase 3: Changes applied

### Files created

- packages/mesh-transport-http/D6F2-FK-1.2-WIRE-CHECK.ts (structural compatibility test)

### Files NOT modified (per scope fence)

No source files modified. All axes already correct from D6F1 delivery.

## Phase 4: Wire-check outcome

```
WIRE OK
```

Structural compatibility verified: Ed25519IdentityVerifier, Ed25519Signer, makeSignFn from @orqenix/transport-security plug into HttpMeshTransport. Two instances communicate with Ed25519 scope signing and verification over HTTP.

## Phase 5: Verification outputs

### 5.1 Build

PASS (tsc -p tsconfig.json)

### 5.2 Tests

PASS (49 tests including G37 gate wrapper)

### 5.3 G37 wrapper

ALL 8 PASS

### 5.4 Router

PASS (32 tests)

### 5.5 Local-node

PASS (20 tests)

### 5.6 Full orchestrator

ALL GATES PASS (89.51s)

## Outstanding items

None. FK-1.2 is verification-only; all axes already correct.
