# @orqenix/injection-strategies

The 5 memory injection strategies from CR v7.1 Chapter 8.

| ID              | Name                   | Where memory goes                     | Best for              |
| --------------- | ---------------------- | ------------------------------------- | --------------------- |
| A               | System Prologue        | system message, all memories          | small contexts        |
| **B (DEFAULT)** | System Prologue Tiered | system message, working+episodic only | balanced              |
| C               | User Annotation        | inline before the last user message   | one-shot Q&A          |
| D               | Assistant Recall Turn  | fake assistant turn before user       | conversational agents |
| E               | Sidecar Vector         | system message, top-k by confidence   | retrieval-heavy       |

```ts
import { STRATEGIES, DEFAULT_STRATEGY } from "@orqenix/injection-strategies";

const out = DEFAULT_STRATEGY.apply({ messages, memories, tokenBudget: 2048, k: 5 });
```

Charter gate: **G9 Injection Strategies**.
