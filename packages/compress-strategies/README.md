# @orqenix/compress-strategies

4 graduated compression strategies for Orqenix Smart Compression Engine (CR v7.1 Chapter 6).

## Preservation Tiers

| Tier  | Meaning                                   |    Drop?    | Summarize? | Distill? |
| ----- | ----------------------------------------- | :---------: | :--------: | :------: |
| **0** | locked system prompts, current user query |    NEVER    |   NEVER    |  NEVER   |
| 1     | recent / sticky context                   | last resort |     NO     |    NO    |
| 2     | mid-importance                            |     OK      |     OK     |    NO    |
| 3     | older history                             |     OK      |     OK     |    OK    |
| 4     | noisy / repetitive                        |  OK first   |     OK     | OK first |

## The 4 strategies

| Strategy                | What it does                                           |    Cost    | When to use                                  |
| ----------------------- | ------------------------------------------------------ | :--------: | -------------------------------------------- |
| `DropStrategy`          | Removes oldest low-tier messages                       |    free    | tight budgets, no information loss tolerated |
| `SummarizeStrategy`     | Collapses runs into one assistant summary              |  LLM call  | retain conversational thread                 |
| `DistillStrategy`       | Extracts memories, drops originals                     | regex only | preserve facts long-term                     |
| `CompressChainStrategy` | Runs drop -> distill -> summarize until target reached |   mixed    | aggressive, automatic                        |

## Tier 0 is sacred

Every strategy throws `Tier0ViolationError` if it would be forced to remove a tier-0 message. The engine in Part B (`@orqenix/smart-compression`) catches this and switches to overflow mode (105% cap from CR v7.1).

Charter gates: **G15 Compression Strategies**, **G16 Tier-0 Preservation**.
