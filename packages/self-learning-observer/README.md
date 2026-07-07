# @orqenix/self-learning-observer

> Apache-2.0 self-learning observer for Orqenix.
> Phase 8 (D8.γ). Charter gate G67 (Observer + Detection, 14 sub-criteria).

## Mission

Watches agent + user interactions to detect recurring patterns worth promoting
to reusable skills. This is Orqenix's differentiation: dynamic skill genesis from
behavior observation.

## Opt-out by default (INV-17 + ADR-E-010)

The observer is ENABLED by default with a prominent first-launch notification.
Users disable at session, branch, or project level at any time. Disabling at a
level disables observation at that level and below.

## What it captures

- Agent tool calls (MCP invocations, file edits, shell commands)
- User actions (chat, code edits, terminal, browser)
- Workflow context (action sequences in time windows)
- Outcomes (success/failure, time spent, retries, undos)
- Memory updates (KB writes, decisions, lessons)

## Privacy (PII filtered)

Observation events pass through the privacy filters from CR v7.3 D7.15
(@orqenix-cloud/privacy-core) before storage. PII is redacted; the
`pii_redaction_applied` flag is recorded.

## 3-level context

Every event carries project_id + branch_id + session_id + parent_session_id
(for subagent observations).

## Storage

`observation_events` table (Migration 530), indexed by tenant + scope + session

- timestamp + actor.

## License

Apache-2.0 , see ./LICENSE
