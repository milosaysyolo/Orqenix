# Security Policy

## Supported Versions

Orqenix follows semantic versioning. We backport security fixes to:

| Version line    | Supported          | End of life |
| --------------- | ------------------ | ----------- |
| 0.5.x (current) | ✅                 | TBD         |
| 0.4.x           | ✅ (critical only) | 2026-09-30  |
| < 0.4           | ❌                 | Already EOL |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security reports.**

Email: `security@orqenix.dev` (or `milo@orqenix.dev` while DNS is being set up).

If you require encryption, our PGP key is published at
`https://orqenix.dev/.well-known/pgp-key.asc` (fingerprint will be added once
the key is generated, tracked in issue #SEC-001).

### What to include

1. Affected package(s) and version range
2. Reproduction steps or PoC
3. Impact assessment (confidentiality, integrity, availability)
4. Suggested remediation, if any

### Our commitment

| Phase                        | SLA                              |
| ---------------------------- | -------------------------------- |
| Acknowledgement              | within 48 hours                  |
| Triage + severity assignment | within 5 business days           |
| Fix or mitigation plan       | within 30 days for High/Critical |
| Public disclosure            | coordinated, typically 90 days   |

We follow the [CVSS v3.1](https://www.first.org/cvss/) scoring framework.

## Scope

In scope:

- All packages under `@orqenix/*`, `@orqenix-pro/*`, `@orqenix-cloud/*`
- The `orqenix` CLI
- Default configuration shipped in `.orqenix/` templates

Out of scope:

- Third-party plugins not published under our scopes
- User misconfiguration of capability tokens
- Issues in upstream dependencies (please report upstream)

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to comply with this policy
- Do not access or modify data beyond what is necessary to demonstrate the issue
- Do not disrupt our services or users

Thank you for helping keep Orqenix and its community safe.
