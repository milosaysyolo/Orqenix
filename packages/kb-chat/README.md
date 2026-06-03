# @orqenix/kb-chat

The first concrete Knowledge Base in Orqenix, chat sessions and entries with vector search and capability-gated writes.

## Features

- SQLite-backed `chat_sessions` + `chat_entries` tables (STRICT mode)
- `chat_embeddings` virtual table for vector similarity (sqlite-vec, default dim 384)
- BLAKE3-linked hash chain across entries (tamper-evident)
- Optional `TokenVerifier` integration: writes require `write:kb-chat` capability
- Local mode: omit the verifier for unauthenticated single-process use

Charter gates: **G3** KB Schema, **G4** Chat KB Operations.
