# @orqenix/scope-link

Per-scope link manifest for the Orqenix local-first mesh (CR v7.1 Ch.13).

## Concept

A **scope link** is a single directional trust edge:

- **outbound** — this scope trusts `remoteScopeId` to answer cross-scope queries
- **inbound** — `remoteScopeId` trusts this scope to provide responses

A bidirectional relationship is **two rows**, one in each direction. This is intentional: revocation of one direction does not implicitly revoke the other.

## State machine

| From    | To         | Why                                      |
| ------- | ---------- | ---------------------------------------- |
| pending | active     | After capability token issued + verified |
| pending | revoked    | Reject the link request                  |
| active  | revoked    | Trust withdrawn                          |
| revoked | (terminal) | Re-link starts a new row                 |

`recordSync()` is only valid in `active` state and updates `lastSyncedAt`.

Charter gate: **G29 Scope Link Lifecycle**.
