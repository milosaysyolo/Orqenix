# D8.γ Self-Learning Architecture

## Overview

The Self-Learning subsystem enables Orqenix to observe user actions, detect repeated patterns, and autonomously generate skills. It operates entirely locally (OSS) with optional cross-project federation (Pro).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Observer Layer                    │
│  Captures → PII filters → Stores action events   │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│               Detection Layer                     │
│  Sequence→Frequency→Candidate→Cooldown           │
│  (Basic OSS / Advanced Pro)                      │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              Promoter Layer                       │
│  List→Review→Promote/Reject/Defer                │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│             Skill Genesis Layer                    │
│  Infer→Synthesize→Generate→Fixture               │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            Verification Layer                      │
│  Replay→Cross-validate→Verify/Auto-disable       │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

- **Opt-out first (INV-17):** Observer is ON by default with prominent notification
- **Approval required (INV-18):** Cross-project candidates show metadata only; sharing requires per-pair approval
- **Unverified by default (Anti-38):** Generated skills are marked unverified; verification gates are enabled by default
- **Local-first:** All data stays on-device unless explicitly approved for cross-project sharing

## Observability

The system emits audit events for all major operations: capture, detection, promotion, genesis, and verification.
