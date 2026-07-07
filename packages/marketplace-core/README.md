# @orqenix/marketplace-core

> Apache-2.0 marketplace core for Orqenix. Full CRUD + interchangeable registries.
> Phase 8 (D8.β). Charter gates G65 (CRUD) + G66 (Normalization).

## Mission

Full marketplace operations on plugins per CR v8.0 Chapter 6:

- **Create / Read / Update / Delete / Fork** plugins
- **Install / Uninstall** via plugin-core lifecycle (D8.α.4)
- **Import / Export** via normalization-engine (D8.β)
- **6 interchangeable registry sources** (Anti-39: no hardcoding)

## CRUD operations

| Operation | Description                                      |
| --------- | ------------------------------------------------ |
| Create    | Build a new plugin from a CSF template           |
| Read      | Browse/search across registry sources            |
| Update    | Version bump + re-validate + audit               |
| Delete    | Confirmation + cleanup + retain audit            |
| Fork      | Clone with renamed namespace                     |
| Import    | External source → CSF (via normalization-engine) |
| Export    | CSF → target platform format                     |
| Install   | Resolve + verify + lifecycle install             |
| Uninstall | Deactivate + remove + retain audit               |

## Registry sources (interchangeable, Anti-39)

| Source             | Backend                            |
| ------------------ | ---------------------------------- |
| `orqenix-official` | plugins.orqenix.dev (Phase 8.2)    |
| `npm`              | npm registry (orqenixPlugin field) |
| `github`           | GitHub topic search                |
| `local-file`       | Local filesystem                   |
| `private-git`      | SSH Git URL                        |
| `enterprise`       | Operator-configured endpoint       |

## License

Apache-2.0 , see ./LICENSE
