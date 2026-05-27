# Embedding Providers

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 8 (Knowledge System).
> Owner: Milo, orqenix.

## 1. Goals

The knowledge layer needs vector embeddings for hybrid retrieval. The
embedding subsystem is designed around three principles:

- Pluggable: any provider behind a single interface
- Cost-aware: every call tracked by the existing cost-tracker plugin
- Resilient: fallback chain handles failures without user intervention

The user picks the provider; Orqenix never hardcodes a vendor.

## 2. Provider interface

### 2.1 Contract

```ts
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}
```

* `name`: identifier used in config and logs
* `dimension`: vector dimension, must match the database schema
* `embed`: single-text embedding
* `embedBatch`: batched embedding with provider-specific batch size

### 2.2 Implementation rule

Implementations are stateless from the caller's perspective. Any caching,
batching, or rate limiting happens inside the provider, not at the call site.

## 3. Built-in providers

### 3.1 openai

* Model: `text-embedding-3-small`
* Dimension: 1536
* API: OpenAI HTTPS endpoint
* Auth: `OPENAI_API_KEY` env var

### 3.2 azure-openai

* Model: configurable, typically `text-embedding-3-small`
* Dimension: matches the deployed model
* API: Azure OpenAI HTTPS endpoint
* Auth: `AZURE_OPENAI_API_KEY` plus `AZURE_OPENAI_ENDPOINT`

### 3.3 voyage

* Model: `voyage-large-2`
* Dimension: 1024
* API: Voyage AI HTTPS endpoint
* Auth: `VOYAGE_API_KEY`

### 3.4 local-onnx

* Model: `bge-small-en` running via ONNX Runtime
* Dimension: 384
* API: in-process, no network
* Use case: airgapped environments, fastest startup, lowest cost

## 4. Provider selection

### 4.1 Config

```json
{
  "embedding": {
    "primary": "openai",
    "fallbacks": ["voyage", "local-onnx"],
    "model": "text-embedding-3-small"
  }
}
```

### 4.2 Dimension match

The configured provider's dimension must match the database schema declared
at DocsKB creation. Mismatch is a fatal startup error. If a user needs to
switch providers across dimensions, they must re-index the entire KB.

## 5. Fallback chain

### 5.1 Trigger conditions

The runtime retries with the next provider when the primary returns:

* HTTP 429 (rate limit) after configured backoff
* HTTP 5xx after configured backoff
* Network timeout
* Authentication failure (only once, then escalates)

### 5.2 Backoff

Default exponential backoff: 250 ms, 500 ms, 1000 ms, then move to next
provider. Configurable per provider.

### 5.3 Cost tracking on fallback

Every fallback call is recorded separately. The cost-tracker shows which
provider served each request. This is critical for understanding bill
attribution after a failure event.

## 6. Caching

### 6.1 In-memory LRU

* Default: 1000 entries
* Key: sha256 of the input text
* Eviction: standard LRU

### 6.2 On-disk persistent cache

* Location: `.orqenix/cache/embeddings/`
* Key: sha256 of input text plus provider name plus model name
* Hit rate on repeated workspaces typically above 70 percent

### 6.3 Cache invalidation

* Model change triggers full cache invalidation
* Provider change does not (unless dimension changes)
* User can run `orqenix embedding cache purge`

## 7. Batch embedding

For large index builds, the indexer calls `embedBatch` with up to 100 texts.
Provider-specific batch limits are respected:

* openai: up to 2048
* azure-openai: matches deployed model
* voyage: up to 128
* local-onnx: limited by available memory

The provider transparently splits oversized batches.

## 8. Offline mode

When `OFFLINE=1` is set, only `local-onnx` is allowed. Network providers
throw at construction time, not at first call. This catches misconfiguration
early.

## 9. Security of API keys

* Keys are read from env vars or from `.orqenix/secrets/` (gitignored)
* Keys never appear in audit logs
* Failed authentication is logged with the provider name only, not the key
  or its prefix

## 10. Embedding quality

Orqenix does not validate embedding quality; that is the user's
responsibility based on their corpus. Recommended practice:

* Run `orqenix kb evaluate` against a held-out query set
* Compare hit-at-K across providers
* Choose the provider with the best balance of quality and cost

## 11. Performance targets

* Single embed call on openai: p95 under 400 ms
* Single embed call on local-onnx: p95 under 50 ms
* Batch of 100 texts on openai: p95 under 1500 ms
* Cache hit: p95 under 1 ms

## 12. Failure modes

* All providers down: hybrid retrieval falls back to FTS-only with a warning
* Embedding dimension mismatch on read: hit is skipped, logged
* Cache corruption: cache is purged, the affected calls re-run

## 13. Roadmap

* Custom provider plugin via the existing plugin system (Phase 5)
* Provider quality scoring (Phase 6)
* Cross-provider re-ranking (Phase 6)
