<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- AGENT PROMPT — File: .orqenix/prompts/wb-design-fix.md -->

# AGENT TASK — Fix Workbench design to match the approved prototype

## Diagnosis (from the W1–W5 reports)
The app BUILDS + serves real data correctly, but the UI looks wrong vs the
prototype because of three leftovers:
1. `app/(workbench)/layout.tsx` still wraps pages in the OLD `WorkbenchShell`
   (tab nav) on top of the new `AppShell` (grouped sidebar) — double/old shell.
2. `globals.css` kept shadcn HSL tokens; `tailwind.config.ts` got a shadcn color
   palette during verify — so shadcn classes render grey/white, not warm cream.
3. Old `workbench-shell.tsx` + `theme-provider.tsx` still present.

## Steps
1. Apply the 4 fix files:
   - app/(workbench)/layout.tsx  (passthrough — remove WorkbenchShell)
   - app/globals.css             (warm tokens only — purge shadcn HSL + @apply reset)
   - tailwind.config.ts          (remap shadcn names → warm tokens)
   - scripts/verify/wb-design-audit.mjs
2. Delete the dead files listed in apps/workbench/DEAD-FILES.md.
3. Run the audit — must be 0 problems:
   ```
   node scripts/verify/wb-design-audit.mjs
   ```
4. Rebuild + open:
   ```
   ORQENIX_DEV=1 pnpm wb:dev   # http://127.0.0.1:27420
   ```
5. Visually confirm vs the approved mockups:
   - Sidebar: grouped WORKSPACE / AGENTS / ECOSYSTEM / OPERATIONS / CONFIG with
     rust active highlight — NOT tabs.
   - Background: warm cream #f6f4ee with faint grid + rust glow — NOT white/grey.
   - Headings serif, labels mono, earthy accents (rust/teal/plum/amber/olive/slate).
   - Dashboard hero = 6-stage pipeline (recall→…→send).

## Hard rules
- Only ONE shell (AppShell from root layout). The group layout is passthrough.
- No shadcn HSL tokens, no `@apply border-border` reset in globals.css.
- Don't touch the API routes / wiring — those are correct.

## Deliverable
- wb-design-audit: 0 problems
- Screenshot of Dashboard + one Agents screen matching the warm prototype
- Confirm: single grouped sidebar, warm cream bg, serif headings, earthy accents.
