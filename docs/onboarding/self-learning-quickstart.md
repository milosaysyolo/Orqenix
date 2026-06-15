# D8.γ Self-Learning Quickstart

The Self-Learning system observes user actions, detects repeated patterns, and helps convert them into reusable skills.

## Prerequisites

- Node.js 20.10+
- pnpm (via corepack)
- Memory Engine SQLite database

## Installation

```bash
pnpm install
```

## Enabling the Observer

1. Open Workbench → Settings → Self-Learning
2. Toggle **Observer** to ON
3. Optionally configure scope-level overrides

The Observer logs anonymized action sequences to local SQLite. No data leaves your machine (INV-17).

## Reviewing Candidates

1. Navigate to Workbench → Learning → Candidates
2. Review detected patterns ranked by impact score
3. Choose action: **Promote**, **Customize**, **Reject**, **Defer**
4. Promoted patterns become verified skills after passing verification loop

## Cross-Project Federation (Pro)

Cross-project learning requires Orqenix Pro. When installed, the system can detect similar patterns across multiple projects — but never shares data without explicit approval (INV-18).

## Package Structure

| Package | Path | Purpose |
|---------|------|---------|
| Observer | `packages/self-learning-observer` | Action capture, PII filtering |
| Detection | `packages/self-learning-detection` | Pattern detection, frequency analysis |
| Promoter | `packages/instinct-promoter` | Candidate review UI + workflow |
| Skill Genesis | `packages/skill-genesis` | CSF skill generation from candidates |
| Verification | `packages/verification-loop` | Auto-verification via replay |
