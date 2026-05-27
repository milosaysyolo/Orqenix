# Knowledge Layer, DocsKB plus CodeKB plus DecisionKB

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 8 (Knowledge System).
> Owner: Milo, orqenix.

## 1. Why three knowledge bases

A single knowledge base forces a single retrieval strategy on every query. In
practice, three retrieval shapes dominate agent work:

- Doc retrieval, prose, snippets, semantic search
- Code retrieval, symbol-based, structural, language-aware
- Decision retrieval, graph traversal, causal chains

DocsKB, CodeKB, DecisionKB are three sibling stores with three distinct
schemas and three distinct retrieval algorithms. They share one orchestration
surface, the `knowledge query` CLI, but their internals are independent.

## 2. DocsKB

### 2.1 Storage

- `docs(id, path, title, content, updated_at)` for the canonical row
- `docs_fts(id, path, title, content)` as an FTS5 virtual table with the
  porter unicode61 tokenizer
- `docs_vec(id, embedding[1536])` as a vec0 virtual table

All three tables live in one sqlite database under `.orqenix/kb/docs.sqlite`.

### 2.2 Write path

- `insertDoc(doc, embedding?)` runs in a transaction that touches all three
  tables
- `deleteDoc(id)` removes from all three
- Re-insert is allowed and replaces in place

### 2.3 Read path

- `searchText(query, limit)` returns FTS hits with snippet markup and a rank
  score
- `searchVec(embedding, limit)` returns nearest neighbors by L2 distance
- `hybridSearch` combines both with a configurable alpha

## 3. CodeKB

### 3.1 Parser

- web-tree-sitter at runtime, no native binding required
- Supported languages: TypeScript, JavaScript, Python, Go
- Grammars shipped as wasm under `packages/kb-code/grammars/`

### 3.2 Symbols extracted

- function, class, method, interface, variable
- Each symbol carries name, kind, start line, end line, language
- File-level metadata: path, language, last modified

### 3.3 Index storage

- sqlite database `.orqenix/kb/code.sqlite`
- `symbols(file, name, kind, start_line, end_line, language)` indexed by name
  and by file
- `files(path, language, sha, indexed_at)` tracks indexing state

### 3.4 Incremental indexing

The indexer compares the current file SHA against `files.sha`. If unchanged,
it skips the file. This keeps re-index time bounded to changed files only.

## 4. DecisionKB

### 4.1 Schema

- `decisions(id, title, decided_at, rationale)`
- `decision_parents(child_id, parent_id)` defines edges
- `decision_tags(decision_id, tag)` for filtering

### 4.2 Traversal

- Ancestors with maxDepth, breadth-first
- Descendants with maxDepth, breadth-first
- Causal chain between two decisions if a path exists

### 4.3 Authoring

Decisions are written via `orqenix decision add`. The CLI prompts for title,
rationale, parents. Each decision gets a deterministic id from the content
hash to avoid collisions.

## 5. Hybrid retrieval

### 5.1 Algorithm

The default hybrid retrieval for DocsKB:

1. Run FTS5 MATCH query against `docs_fts`, retrieve top N (default 20)
2. Compute query embedding via the configured EmbeddingProvider
3. Run vec0 MATCH against `docs_vec`, retrieve top N (default 20)
4. Normalize FTS rank to [0,1] inverted (lower rank means better)
5. Normalize vec distance to [0,1] inverted (lower distance means better)
6. Final score = (1 - alpha) * fts_norm + alpha * vec_norm
7. Apply document grader for diversity
8. Return top M (default 10)

### 5.2 Alpha tuning

Default alpha is 0.6, vec-leaning. For pure keyword queries, alpha drops to
0.2 automatically when the query is detected as boolean (contains AND, OR,
quoted phrases).

### 5.3 Document grader

The grader runs after hybrid ranking:

- Drop hits below minScore (default 0.1)
- Apply diversity penalty when consecutive hits share the same parent path

The grader prevents a single directory from dominating results, which is a
common failure mode when one folder has very high-quality docs.

## 6. Embedding provider interface

### 6.1 Contract

```ts
interface EmbeddingProvider {
  dimension: number;
  embed(text: string): Promise<Float32Array>;
}
```

### 6.2 Built-in providers

* `openai`, text-embedding-3-small, 1536 dim
* `azure-openai`, same model behind Azure
* `voyage`, voyage-large-2, 1024 dim
* `local-onnx`, bge-small-en, 384 dim, runs without network

Dimension mismatch between provider and database is a fatal error at startup,
not a runtime warning.

### 6.3 Fallback chain

The user configures one primary and N fallbacks. On primary failure (network,
rate limit, auth), the runtime retries with the next provider after the
configured backoff.

Cost tracking is integrated: every call records provider, tokens, and USD
cost into the existing cost-tracker plugin.

## 7. Caching

### 7.1 Embedding cache

Two-level cache:

* In-memory LRU, default 1000 entries
* On-disk persistent cache keyed by sha256(text) under `.orqenix/cache/embeddings/`

The on-disk cache survives across sessions. It saves both money and latency.

### 7.2 Query result cache

Hybrid search results cache by query hash for a configurable TTL (default 60
seconds). Useful for chained agent workflows that repeat the same retrieval.

## 8. Cross-KB queries

Some queries span multiple KBs. Example: "where was this decision
implemented" maps decision id to file paths in CodeKB.

The cross-KB router is a thin layer that decomposes the query, runs against
each KB, and joins on shared identifiers (file path, decision id).

## 9. Citation linkback

Every retrieved hit carries enough metadata to render a citation:

* DocsKB: file path plus line range from snippet markup
* CodeKB: file path plus symbol name and line range
* DecisionKB: decision id plus title

The CLI renders citations as inline references. The MCP server returns them
as structured fields so editors can deep-link.

## 10. Security boundaries

* KB databases are local files, not network services
* The MCP server enforces a read-only allowlist by default
* Write access requires explicit hook profile permission (see sandbox doc)

## 11. Performance targets

Enforced by `pnpm bench:phase-4`:

* Hybrid search on 1000 docs, p95 under 300 ms
* Code symbol lookup, p95 under 50 ms
* Decision traversal depth 10, p95 under 100 ms

## 12. Capacity targets

* DocsKB tested up to 100k docs, 1.5 GB on disk
* CodeKB tested up to 50k symbols across 5k files
* DecisionKB tested up to 10k decisions with average 3 parents each
