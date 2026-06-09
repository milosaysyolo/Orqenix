# @orqenix/mesh-discovery

Mesh discovery for Orqenix Phase 6.

- mDNS local-LAN discovery with service tag `orqenix-mesh`
- Bootstrap YAML parser with reconnect policy
- Typed discovery event lifecycle (Discovered, Connecting, Connected, Stale, Lost)
- Observation-only: never auto-dials, emits events for transport to act on

See [CR v7.2 Chapter 5](../docs/CR/v7.2/chapter-5-mesh-discovery.md) for architecture.
