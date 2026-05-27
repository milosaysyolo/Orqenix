# Why Pro

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 1.1 (Identity), Chapter 1.8 (Strategic Position).
> Owner: Milo, orqenix.

## 1. The three tiers

Orqenix is divided into three tiers, each with a distinct license and a
distinct value proposition:

- OSS Core: orchestration, memory, marketplace consumer, free forever
- Pro: intelligence layer, lifecycle governance, paid
- Cloud: managed multi-tenant SaaS, paid per usage

The boundary between OSS and Pro is the line between "agents that run" and
"agents that get smarter and stay safe over time".

## 2. Feature matrix

| Feature | OSS | Pro | Cloud |
|---|---|---|---|
| Orchestrator engine | yes | yes | yes |
| 4-tier persistent memory | yes | yes | yes |
| Plugin system | yes | yes | yes |
| MCP client and server | yes | yes | yes |
| Skill loader (npm, local, URL, GitHub) | yes | yes | yes |
| Compression plugins (input, output, context) | yes | yes | yes |
| Skill marketplace consumer | yes | yes | yes |
| DocsKB hybrid retrieval | yes | yes | yes |
| CodeKB symbol index | yes | yes | yes |
| DecisionKB graph | yes | yes | yes |
| Continuous learning loop | no | yes | yes |
| Cross-project retrieval ranking | no | yes | yes |
| Decision graph causal traversal | no | yes | yes |
| Skill author signing | no | yes | yes |
| License gating | no | yes | yes |
| Lifecycle versioning, snapshot, GC | yes | yes (advanced) | yes |
| Sandbox executor (3 profiles) | yes (strict only) | yes (all) | yes (all) |
| Multi-tenant SaaS | no | no | yes |
| Managed embedding | no | no | yes |
| Hosted marketplace | no | no | yes |
| Customer-facing dashboard | no | no | yes |

## 3. Why these particular features are Pro

The OSS tier covers the substrate. Anyone can run agents, organize their
memory, install skills. That is the table-stakes layer, and it stays free
because the value of Orqenix grows with adoption.

The Pro tier covers the intelligence and trust layer:

- Continuous learning: agents that get better from session to session
- Cross-project retrieval: knowledge that survives boundaries
- Decision causality: understanding why a system is the way it is
- Lifecycle governance: production-grade safety nets

These are the features that make Orqenix mission-critical. Mission-critical
deserves a sustainable funding model.

## 4. Pricing thesis

In Phase 4, pricing is not yet locked. The intent:

- Pro: per workspace per month, indie-friendly
- Pro Team: per seat per month, with team-shared knowledge layer
- Cloud: usage-based, with a generous free trial

The OSS tier remains free forever. No bait-and-switch.

## 5. 96-feature monetization classification

Per CR v6.2, all 96 declared features are classified by tier. The
classification is published in `docs/monetization/feature-classification.md`
and updated only via PR review.

Three rules:

- A feature never moves from OSS to Pro
- A feature can move from Pro to OSS (we sometimes downgrade for adoption)
- A feature can move from Pro to Cloud only with a 12-month deprecation
  notice in Pro

## 6. Anti-goals

The Pro tier deliberately does not include:

- A coding agent (we are not competing with Claude Code, Codex, OpenCode)
- A desktop UX layer (we are not competing with Cowork)
- A vendor-locked LLM (we route to user-chosen providers)

These are explicit anti-goals from CR v6.2 §1.5. Pro stays focused on the
orchestration and intelligence layer.

## 7. Customer personas

### 7.1 Solo founder

- OSS is enough for personal projects
- Pro becomes attractive when they ship to production
- Cloud comes in when they want zero-ops

### 7.2 Small team (2 to 10)

- OSS for early experimentation
- Pro Team for shared knowledge and learning loop
- Cloud rarely used at this stage

### 7.3 Mid-size org (10 to 50)

- Pro Team for daily use
- Cloud for hosted infrastructure, audit log, SSO

### 7.4 Skill author

- OSS to publish skills
- Pro to sign skills and enable monetization

## 8. Migration paths

### 8.1 OSS to Pro

- Run `orqenix pro install <license>`
- New features activate without re-install
- All existing data preserved

### 8.2 Pro to OSS

- Let license expire
- Grace window of 7 days
- After grace, Pro features disable; OSS features keep working
- No data lost

### 8.3 Pro to Cloud

- One-way migration via `orqenix cloud migrate`
- Local workspace becomes a Cloud workspace
- Reverse migration supported with a 30-day window

## 9. Comparison to alternatives

### 9.1 Closed-source proprietary

Faster to ship, harder to trust, vendor-lock-in. We trade some velocity for
trust by keeping the OSS core.

### 9.2 Pure OSS, donations only

Sustainable for small projects, not for production-grade systems with the
support burden Orqenix takes on. The Pro tier funds ongoing work.

### 9.3 OSS with paid hosting only

Some projects gate only the hosting. We do the opposite: hosting is
optional; the intelligence layer is the real value.

## 10. Sustainability model

The goal is for Pro revenue to fund:

- Two full-time engineers in Phase 5
- Continuous CI for a 6-OS, 3-Node matrix
- A community manager once the community reaches 1000 users

If Pro revenue ever falls below break-even, the response is to improve Pro,
not to gate more OSS features. The OSS commitment is permanent.

## 11. Open questions

- Volume pricing for enterprises (Phase 5)
- Educational discount (Phase 4)
- Open-source contributor licenses (Phase 4)
