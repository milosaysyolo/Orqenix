# Licensing

Orqenix uses a **3-tier model**. We chose this model so that the full
local-first mesh, the scope identity layer, and the provenance system are
permanently free and open source.

## Tier 1 — Orqenix (OSS)

- **License**: Apache License 2.0
- **Repo**: [github.com/milosaysyolo/Orqenix](https://github.com/milosaysyolo/Orqenix)
- **npm scope**: `@orqenix/*`
- **What you get**: full local-first mesh, scope identity, capabilities,
  SQLite-based KBs, ChatKB, CodeKB, compress-as-memorize, Memory MCP tools,
  CLI, hook system.

## Tier 2 — Orqenix-Pro

- **License**: Business Source License 1.1, **converts to Apache 2.0 after 4 years**
- **Repo**: [github.com/milosaysyolo/Orqenix-Pro](https://github.com/milosaysyolo/Orqenix-Pro)
- **npm scope**: `@orqenix-pro/*`
- **What you get on top of OSS**: LLM-based distiller, polyglot backends
  (LMDB / Kuzu / LanceDB), mesh delegation with cap narrowing, blast-radius
  quotas, token cache.
- **What "BSL 1.1" means in practice**: you can use it freely in production
  for your own product, including paid products. The only thing you cannot do
  is offer Orqenix-Pro itself as a hosted service to third parties during the
  4-year window. After 4 years, each released version automatically converts
  to Apache 2.0.

## Tier 3 — Orqenix-Cloud (Phase 7)

- **License**: commercial, separate terms, free tier for individuals
- **What you get on top of Pro**: hosted relay for NAT-traversal,
  multi-machine mesh, Web UI inspector, team workspace primitives.

## Anti-patterns we explicitly avoid

We promise we will never:

- Paywall basic mesh linking
- Paywall scope identity
- Paywall provenance tagging
- Add telemetry on by default
- Remove existing OSS features to push them to a paid tier

## Questions

For licensing questions, including OEM, embedded, or large-scale deployments,
contact `licensing@orqenix.dev`.
