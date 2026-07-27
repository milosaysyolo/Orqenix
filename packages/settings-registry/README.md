# @orqenix/settings-registry

> Apache-2.0 settings registry for Orqenix.
> Phase 8 Foundation (D8.α.5), Charter gate G64 (10 sub-criteria).

## Mission

Every module in Orqenix declares its own settings schema and registers with
this central registry. This makes ~145 settings (Phases 2-8) discoverable,
hot-reloadable, exportable, and hierarchically overridable.

Per CR v8.0 Chapter 10 + ADR-E-009 + Anti-pattern 37.

## Key features

- **Module-owned schemas**: each module declares `ModuleSettingsContract`
- **Hierarchy override**: session → branch → project → user → system → built-in
- **Hot reload**: settings flagged `hotReloadable` apply in <= 100ms
- **Export/Import**: JSON/YAML cross-machine portability
- **Versioning**: backwards-compat with default change notification
- **Phase lock badges**: provenance tracking (P2/P3/P4/P6/P7/P8)
- **Audit trail**: every setting change recorded

## Resolution order (per ADR-E-009)

```
Session-level setting       (highest priority)
       ↓ (fallback if not set)
Branch-level setting
       ↓
Project-level setting
       ↓
User global setting         (~/.orqenix/global-config.yaml)
       ↓
System fallback setting     ($ORQENIX_HOME/system-config.yaml)
       ↓
Built-in default            (from ModuleSettingsContract.defaults)
```

## Usage

### Register a module's settings

```ts
import { SettingsRegistry } from "@orqenix/settings-registry";

const registry = new SettingsRegistry();

registry.register({
  moduleId: "@orqenix/memory-engine",
  version: "0.8.0",
  settingsSchema: {
    /* JSON Schema */
  },
  defaults: {
    "hierarchy.level_boost.session": 1.5,
    "hierarchy.level_boost.branch": 1.2,
    "hierarchy.level_boost.project": 1.0,
  },
  provenance: {
    phase: 8,
    crVersion: "v8.0",
    rationale: "Default level boost values from Phase 8 architecture",
  },
  hotReloadable: true,
  hierarchyOverride: "all",
});
```

### Resolve a setting

```ts
const resolved = await registry.resolve("@orqenix/memory-engine", "hierarchy.level_boost.session", {
  sessionId: "...",
  branchId: "...",
  projectId: "...",
});

console.log(resolved.value); // 1.5 (or overridden value)
console.log(resolved.source); // 'built-in-default' | 'session' | 'branch' | ...
```

### Update a setting (with hot reload)

```ts
await registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 2.0, {
  level: "project",
  hierarchyId: "blake3:...",
});
// hotReloadHandler fires within 100ms if declared
```

### Export / Import

```ts
import { exportSettings, importSettings } from "@orqenix/settings-registry";

const yaml = await exportSettings(registry, { level: "all", format: "yaml" });
// ... transfer to another machine ...
await importSettings(registry, yaml, { mode: "merge" });
```

## Phase lock badges

Each setting shows which phase locked its default via `provenance.phase`.
The Workbench Settings UI displays badges (P2/P3/P4/P6/P7/P8) with tooltips
linking to the relevant CR chapter.

## License

Apache-2.0 , see ./LICENSE
