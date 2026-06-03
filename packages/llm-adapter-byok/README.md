# @orqenix/llm-adapter-byok

BYOK (Bring Your Own Key) LLM adapters with cost-tier defaults per CR v7.1 Chapter 7.

| Adapter | Default Model | Use case |
|---------|--------------|----------|
| `OpenAiAdapter` | `gpt-4o-mini` | balanced |
| `AnthropicAdapter` | `claude-haiku-4` | fastest paid |
| `GoogleAdapter` | `gemini-flash-2.5` | cheapest large-context |
| `DeepSeekAdapter` | `deepseek-chat-v3` | cheapest with reasoning |

All adapters share the `LlmAdapter` interface from `@orqenix/llm-adapter-ollama`.

## FallbackChain

```ts
import { FallbackChain, OpenAiAdapter, AnthropicAdapter } from '@orqenix/llm-adapter-byok';
import { OllamaAdapter } from '@orqenix/llm-adapter-ollama';

const chain = new FallbackChain({
  adapters: [
    new OllamaAdapter(),                                    // try local first
    new OpenAiAdapter({ apiKey: process.env.OPENAI_KEY! }), // then BYOK
    new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_KEY! }),
  ],
});
```

Charter gates: **G12 BYOK Fallback Chain**, **G13 Adapter Provider Switching**.
