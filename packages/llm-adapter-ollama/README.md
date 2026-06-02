# @orqenix/llm-adapter-ollama

Local LLM adapter using the Ollama HTTP API. Default model: `qwen2.5:7b`.

## Why this is the OSS default

CR v7.1 chooses Qwen 2.5 7B via Ollama as the OSS default because:

1. Runs fully offline on consumer hardware (8GB+ VRAM or CPU)
2. Apache-2.0 weights, no API key, no telemetry
3. Strong instruction following at small size for the prompt-rewriter use case

## Quick start

```ts
import { OllamaAdapter } from '@orqenix/llm-adapter-ollama';

const llm = new OllamaAdapter({ model: 'qwen2.5:7b' });
const r = await llm.complete({ messages: [{ role: 'user', content: 'hi' }] });
console.log(r.content);
```

Charter gate: **G8 LLM Adapter Contract**.
