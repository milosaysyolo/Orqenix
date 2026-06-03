# @orqenix/workspace

Workspace concept for grouping scope memberships in the Orqenix mesh.

## Concept

A **workspace** is a named container with exactly one **owner** scope and zero or more **contributor** or **observer** scopes. Workspaces are the unit of cross-scope query coordination (see `@orqenix/mesh-routing`).

| Role        | Can write KB? | Can query others' KB? | Can change membership? |
| ----------- | ------------- | --------------------- | ---------------------- |
| owner       | yes           | yes                   | yes                    |
| contributor | yes           | yes                   | no                     |
| observer    | no            | yes                   | no                     |

## Invariants

- Every workspace has exactly one `owner`.
- An owner cannot be removed without first calling `transferOwnership`.
- `delete(workspaceId)` cascades to all memberships via FK.

Charter gate: **G31 Workspace Membership**.
