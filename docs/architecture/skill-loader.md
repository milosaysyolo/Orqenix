# Skill Loader

## Problem

Skills come from many sources: built-in, project-local, global config,
GitHub repos, tarballs, npm packages. Discovery, ranking, and installation
must work consistently.

## Constraints

- File format is fixed by OpenCode: `SKILL.md` with YAML frontmatter,
  one folder per skill.
- Project-local skills must override globals on conflict.
- Installation must be atomic (no half-installed states).

## Design

### Discovery

Walks four directories per OpenCode conventions:

- `.opencode/skills/<name>/SKILL.md` (project)
- `.orqenix/skills/<name>/SKILL.md` (project, Orqenix-only)
- `~/.config/opencode/skills/<name>/SKILL.md` (global)
- `~/.config/orqenix/skills/<name>/SKILL.md` (global)

Deduplicates by `name` field. Project entries win.

### Ranking (Phase 2: lexical)

Score = exact-phrase + token-overlap + project-priority.
Threshold drops low-confidence matches.

### Ranking (Phase 4+: semantic)

The `rankSkills()` signature is stable. Internals swap to embedding-based
re-rank when DocsKB lands.

### Installation

Resolves source to a local directory, copies subdirectories containing
SKILL.md into `.opencode/skills/`. Atomic: replaces existing on `--force`,
refuses otherwise.

## Tradeoffs

- Chose **lexical ranking first**. Semantic is better but requires Phase 4 KB.
- Chose **copy on install** over **symlink**. Cross-platform reliability.

## Open questions

- npm package skills: should we auto-`npm install` or require user to do it?
  Phase 3 decision.
- Skill versioning: `SKILL.md` has no version field. Should we add one?
