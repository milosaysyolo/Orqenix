# @orqenix/capability-tokens

Ed25519-signed capability tokens for the Orqenix local-first mesh (CR v7.1 Chapter 14).

## Token format

Compact JWT-style: `headerB64u.payloadB64u.signatureB64u`.

```
header:    { alg: "EdDSA", typ: "ORQX", kid: <issuer scopeId> }
payload:   { iss, sub, aud, iat, nbf, exp, jti, caps[], maxDelegationDepth }
signature: 64 bytes Ed25519 over UTF-8("headerB64u.payloadB64u")
```

`jti` is BLAKE3 over the canonical-JSON payload (sans jti), truncated to 20 bytes, base32 encoded with the `tok:` prefix.

## 6 permission scenarios

| Action | Meaning |
|--------|---------|
| `read` | Read KB entries |
| `write` | Append or update KB entries |
| `delegate` | Issue sub-tokens to other scopes |
| `query` | Cross-scope mesh query |
| `distill` | Trigger background distillation |
| `mesh` | Join, leave, change mesh topology |

Capability strings: `<action>:<resource>` or `<action>:<resource>:<scopePattern>`.
Resources: `kb-docs | kb-code | kb-chat | kb-decisions | audit-log | *`.

## Issue, verify, delegate, revoke

```ts
import { issueToken, TokenVerifier, delegateToken, RevocationStore } from '@orqenix/capability-tokens';

const { encoded } = await issueToken({
  issuerScopeId: ME,
  issuerPrivateKey: MY_PRIV,
  subjectScopeId: PARTNER,
  audienceScopeId: ME,
  caps: ['read:kb-docs', 'delegate:read:kb-docs'],
  ttlSeconds: 3600,
  maxDelegationDepth: 1,
});

const verifier = new TokenVerifier({
  getIssuerPublicKey: async (kid) => await myKeyResolver(kid),
  revocationStore: new RevocationStore(process.cwd()),
});
const token = await verifier.verify(encoded, 'read:kb-docs');
```

## Charter gates

- **G27** Token Format Integrity
- **G28** Token Signature Verification
- **G32** Token Revocation
