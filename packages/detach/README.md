# @orqenix/detach

Safe detach for Orqenix scopes (CR v7.1 Ch.16). Implements the 2-step destructive operation pattern: **prepare → confirm → execute**.

## Why 2 steps

Detach is irreversible (revoked links cannot return to active; workspaces deleted cascade). The planner returns a `confirmationToken` that the caller must echo back to the executor. This guards against:

- Accidental invocation by tools that don't display the plan first
- Replay attacks (each plan generates a fresh token via 16-byte random salt)
- Cross-plan confusion (a token for an unlink cannot execute a full-detach)

## Two kinds

| Kind            | What happens                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `unlink-remote` | Revokes both directions of links to a single remote scope                                                               |
| `full-detach`   | Revokes all active links, deletes owned workspaces, removes `.orqenix/` contents (preserving `identity.key` by default) |

## Quick start

```ts
import { DetachPlanner, DetachExecutor } from "@orqenix/detach";

const planner = new DetachPlanner({ localScopeId, linkStore, workspaceStore, auditStore });
const executor = new DetachExecutor({
  localScopeId,
  linkStore,
  workspaceStore,
  auditStore,
  rootDir: process.cwd(),
});

const plan = planner.planUnlink(REMOTE_SCOPE);
console.log(
  `This will revoke ${plan.affectedLinks} links. Confirm by passing token:`,
  plan.confirmationToken,
);

// Later, with user confirmation:
const report = await executor.execute(plan, plan.confirmationToken);
console.log(`Detached at ${report.executedAt}, verifier chain hash: ${report.verifierChainHash}`);
```

Charter gates: **G17 Detach Roundtrip**, **G30 rm-rf .orqenix Safety**.
