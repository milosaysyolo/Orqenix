# @orqenix/normalization-engine

> Apache-2.0 normalization engine for Orqenix.
> Phase 8 (D8.β). Charter gate G66 (Normalization Engine, 18 sub-criteria).

## Mission

Imports plugins from 14 external formats into the Canonical Skill Format (CSF),
and exports CSF back to 8 platform formats. Round-trip fidelity is byte-identical
(modulo whitespace) per INV-15 + ADR-E-015.

## Pipeline (CR v8.0 Chapter 8)

```
Import:  External format → InputAdapter.parse() → CSF
Export:  CSF → OutputAdapter.serialize() → Target format
```

## 14 Input Adapters

claude-code, cursor, codex, opencode, mcp, continue, aider, cline, npm,
github, url, local-file, private-git, user-custom

## 8 Output Adapters

claude-code, cursor, codex, opencode, mcp, continue, aider, npm

## Round-trip fidelity (INV-15)

For every adapter pair (input + output):

```
original → import → CSF → export → output
assert: normalizeWhitespace(original) === normalizeWhitespace(output)
```

Provenance preserves the original format via `provenance.original_format_preserved`,
so round-trip is lossless even when CSF has richer fields than the target.

## Lossy exports

When a target platform can't represent all CSF features, the OutputAdapter
returns an `ExportabilityReport` listing lossy fields. The caller (marketplace)
surfaces these before exporting.

## License

Apache-2.0 , see ./LICENSE
