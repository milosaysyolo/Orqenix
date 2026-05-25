# Compression System (Phase 3)

## Problem

Agent context grows fast. Tool outputs are verbose. Conversations accumulate
history that costs tokens but contributes nothing to the next decision.

Three distinct compression problems, three distinct solutions.

## Constraints

- Never break semantics (compressed output must still be useful to the LLM)
- Never paywall persistence (Monetization Lock Rule 3)
- Configurable per-project, per-scope
- Soft mode default; aggressive opt-in
- Preserve checkpoints and decisions always

## Design

### Three compression plugins

```
compress-input   → LLM call inputs
compress-output  → tool execution outputs
compress-context → ongoing conversation history
```

Each is an independent plugin with its own lifecycle hook.

### compress-input (priority 70)

Hooks `llm.call.before`. Transformations:
1. Whitespace cleanup (collapse blank lines, trim trailing)
2. Adjacent message dedup
3. Auto-inject concision instructions to system prompt

Mode "soft" (default) does only 1 and 2. Mode "rewrite" adds pseudo-code.

### compress-output (priority 70)

Hooks `tool.execute.after`. Type-aware compression:
- `file_list`: directory grouping + count summary
- `logs`: error preservation + dedup + frequency count
- `json`: array first 3 + last 1; object schema preview
- `search_results`: top 5 + score range
- generic text > 4000 chars: head + middle truncate notice + tail

Only triggers when output exceeds `thresholdTokens` (default 2000).

### compress-context (priority 80)

Hooks `session.end` (Phase 3) and conversation events (Phase 3.5 when
LLM dispatch lands). Smart-detect triggers:
- `onTaskComplete`: compress completed task's messages
- `onMilestone`: compress before a milestone marker
- `onContextPressure`: trigger at 70% of model context limit
- `onTopicShift`: detect topic boundary and compress prior topic
- `onIdle`: optional, defaults off

Preservation rules (defaults match Monetization Lock):
- `decisionKB`: true (decisions are expensive to re-derive)
- `docsKB`: false (will reindex; cached snapshot drifts)
- `codeKB`: false (will reindex; cached snapshot drifts)
- `checkpoints`: true (never compress milestones)
- `protectedTags`: true (explicit `<protect>` blocks)

## Tradeoffs

- Chose **conservative default** (soft mode) over aggressive. Risk of
  semantic damage outweighs marginal token savings in normal flow.
- Chose **lexical heuristics** over LLM-based rewrite. The point is to
  save tokens, not spend them on a rewrite call.
- Chose **type detection** over **manual annotation** for compress-output.
  Agents shouldn't have to declare output shapes.

## Open questions

- How to invalidate cache when re-running same call with different intent?
  Currently no invalidation; entries simply expire from LRU.
- Should `compress-context` queue compressions for off-line processing?
  Phase 6 (Web UI) will expose a visualizer for live compress events.

## References

- DCP plugin for OpenCode (inspiration, clean-room reimplementation)
- Anthropic prompt caching documentation (concision instruction pattern)
