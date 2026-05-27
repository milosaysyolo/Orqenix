# Phase 4 Rollback Plan

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 11 (Lifecycle), Chapter 16 (CI).
> Owner: Milo, orqenix.

## 1. When to invoke rollback

Rollback is the last resort, never the first. The decision tree:

1. Critical bug in production, no forward fix possible within 4 hours
2. Charter regression detected on `main` after merge
3. Data corruption detected in DocsKB, CodeKB, or DecisionKB
4. Security incident requiring immediate state revert

If none of the above apply, the response is hotfix forward, not rollback.

## 2. Rollback boundaries

### 2.1 What can be rolled back

- Orqenix OSS code, via git revert to tag
- Orqenix-Pro code, via git revert to tag
- Workspace state, via `orqenix snapshot restore`
- Lockfile, automatically as part of snapshot restore
- Knowledge bases, restored from snapshot copies

### 2.2 What cannot be rolled back

- User source code changes made outside Orqenix
- External API calls already made (LLM invocations, embeddings)
- Customer-facing license issuances already delivered

The boundary is the boundary of Orqenix's authority. We do not undo things
outside our domain.

## 3. Rollback procedures

### 3.1 Code rollback

```bash
git checkout v0.3.0-phase-3
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm verify-phase-3
```

If all four steps succeed, the codebase is back to a known-good state. Tag
the rollback as `v0.4.0-rollback-<date>` for audit clarity.

### 3.2 Data rollback

```bash
orqenix snapshot list
orqenix snapshot show <id>
orqenix snapshot restore <id> --dry-run
orqenix snapshot restore <id>
```

The dry-run step is mandatory. Never restore without inspecting the diff.

### 3.3 Marketplace rollback

```bash
orqenix marketplace pin <marketplace-name> <previous-sha>
orqenix sync
orqenix verify
```

This re-pins to the previous known-good SHA and re-validates the workspace.

### 3.4 License rollback

If a bad license was issued:

* Add the license id to the revocation list
* Sign and publish the updated revocation list
* Notify the affected customer with a replacement license

## 4. Post-rollback verification

### 4.1 Charter re-run

```bash
pnpm charter:phase-3
```

Phase 3 charter must pass 100 percent. If it does not, the rollback itself
failed and the team escalates.

### 4.2 Smoke test

```bash
pnpm smoke
```

Full smoke suite covers init, install, sync, doctor.

### 4.3 Customer probe

For customers on Pro or Cloud, a synthetic probe:

* Issue a known query against DocsKB
* Verify the expected hit is returned
* Verify the citation linkback resolves

## 5. Communication plan

### 5.1 Internal

* Slack incident channel updated within 5 minutes of decision to rollback
* Post-incident review scheduled within 48 hours
* Action items tracked in `docs/incidents/<date>-rollback.md`

### 5.2 Customer-facing

For Pro and Cloud customers affected by the rollback:

* Status page updated immediately
* Email with subject "Orqenix service notice, brief downtime"
* Post-mortem published within 7 days
* Credit applied to affected accounts automatically

### 5.3 Community

* Public GitHub issue acknowledging the rollback
* Discord and the orqenix.dev blog updated
* No internal details leaked; respect the audit timeline

## 6. Customer notification template

> Subject: Orqenix service notice
>
> We rolled back Orqenix from version 0.4.0 to 0.3.0 at [time UTC] due to
> [brief reason]. Service has been restored. We are investigating the root
> cause and will publish a post-mortem within 7 days.
>
> If you were affected, please open a support ticket and reference incident
> [id]. We have applied a credit of [amount] to your account.
>
> Thank you for your patience.

## 7. Post-mortem template

```md
# Incident <id>, <title>

## Summary
One paragraph describing what happened.

## Timeline
- T-30m: ...
- T-15m: ...
- T+0:  decision to rollback
- T+5m: rollback executed
- T+15m: verification complete
- T+30m: communication sent

## Root cause
What broke. No blame, no euphemism.

## Detection
How we found out.

## Response
What we did.

## Impact
- Customers affected: N
- Workspace-hours of degraded service: H
- Data loss: amount

## Action items
- [ ] Add charter gate to catch this case
- [ ] Add monitoring for X
- [ ] Update runbook
```

## 8. Recovery testing

Rollback procedures are tested quarterly against a staging mirror:

* Restore a workspace to the previous snapshot
* Re-run the full smoke suite
* Measure time-to-recovery

Target: time-to-recovery under 30 minutes from decision to rollback to
verified recovery.

## 9. Roll-forward

In some cases, the better path is roll-forward: ship a hotfix that addresses
the root cause without reverting state. Decision criteria:

* Forward fix can be tested in under 60 minutes
* Forward fix is contained to one package
* Forward fix does not introduce schema changes
* Customer impact is degraded service, not data loss

If any criterion fails, prefer rollback.

## 10. Forbidden patterns during rollback

* No manual edits to snapshot files
* No bypassing of the charter verification step
* No silent restore without diff review
* No reusing a license that was revoked
* No skipping the post-mortem
* No partial rollback (the system is either at version N or version N-1, never in between)

## 11. Roles and responsibilities

* Incident commander: makes the rollback decision
* Engineer: executes the rollback procedure
* Communicator: handles internal and external messaging
* Reviewer: signs off on post-rollback verification

Solo-operator mode (current Orqenix state): one person fills all four roles,
but each step is still executed and logged separately.

## 12. Glossary

* Snapshot: an atomic, hash-verified copy of workspace state
* Tag: a named git revision representing a known-good state
* Charter: the gate suite that verifies a release is shippable
* Grace period: the 7-day window after license expiry
* Lockfile pin: the recorded SHA of an installed skill
