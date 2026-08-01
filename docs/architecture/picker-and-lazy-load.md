# Picker and Lazy Loader (Phase 3)

## Problem

Two related context-economy patterns:

1. **Picker**: when retrieval returns 100 candidates, send only the top 5
   to the LLM. With diversity, avoid sending 5 near-identical results.

2. **Lazy loader**: when context references a file, send a reference
   handle, not the full content. Fetch on demand when the agent actually
   reads it.

Both reduce wasted tokens.

## Constraints

- Picker must work without semantic embeddings in Phase 3 (Phase 4 adds them)
- Lazy loader must detect file modification between handle creation and read
- Cross-platform (no native deps)
- Cache must respect memory budget

## Design

### Picker

`pickTopN(candidates, config)`:

1. Filter by `minScore`
2. If `diversity: false`: sort by score, slice top N
3. If `diversity: true`: apply MMR (Maximal Marginal Relevance)

MMR formula:

```
score(c) = λ·relevance(c) - (1-λ)·max(similarity(c, s)) for s in selected
```

Similarity sources:

- If `vector` present on both: cosine similarity (Phase 4 with embeddings)
- Else if `text` present: Jaccard on tokens (Phase 3 fallback)
- Else: 0 (no diversity penalty)

### Lazy loader

`LazyContentLoader`:

- `createHandle(path)`: reads file, returns `{path, size, hash, mtime}`
- `load(handle)`: reads file, verifies hash matches handle. Throws if file
  modified since handle creation
- `tokenizeReferences(text, paths)`: replaces file paths in text with
  `[orqenix:lazy-ref <path>#<hash> (<bytes>)]` placeholders

LRU cache with byte budget. Default 50 MB.

## Tradeoffs

- Chose **hash verification on read** over **mtime check**. mtime is unreliable
  across platforms and across filesystem types. BLAKE3 of content is the
  source of truth.

- Chose **placeholder injection** as the lazy reference format.
  Custom delimiters `[orqenix:lazy-ref ...]`: clear, unambiguous, easy to
  detect and resolve.

## Phase 4 evolution

- Picker will accept embedding vectors from Knowledge layer (DocsKB/CodeKB)
- Lazy loader will integrate with CodeKB's symbol-level chunks for partial
  file loading (load just one function, not the whole file)

## References

- MMR algorithm (Carbonell & Goldstein 1998)
- BLAKE3 (https://github.com/BLAKE3-team/BLAKE3)
- LRU eviction patterns
