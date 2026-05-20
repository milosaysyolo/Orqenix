# Orqenix

Orqenix is a production-grade orchestration engine for AI agent systems.

It enables developers to build, run, and scale multi-agent workflows with:
- a modular orchestration runtime
- pluggable memory and RAG pipelines
- skill and plugin execution
- built-in observability and cost control
- extension-based architecture for enterprise features

## Why Orqenix

- Built for production, not demos
- Designed for multi-agent systems at scale
- Extension-first architecture
- Runtime-agnostic across LLM providers
- Cost-aware by design

## Quick start

```bash
npm install -g @orqenix/cli
orqenix init my-agent
orqenix run
````

## Roadmap

* [ ] Core orchestrator
* [ ] Agent runtime
* [ ] Memory system (MCP)
* [ ] Skill/plugin system
* [ ] Observability
* [ ] Governance (Pro)
* [ ] Cloud platform

## License

Apache 2.0

---

## 5. Naming structure

```

orqenix          → OSS core
orqenix-pro      → enterprise
orqenix-cloud    → SaaS

```

Packages:

```

@orqenix/core
@orqenix/agents
@orqenix/skills
@orqenix/cli

```
