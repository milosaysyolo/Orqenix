<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- AGENT PROMPT — File: apps/workbench/DEAD-FILES.md
     These files are superseded and cause the wrong-design conflict. DELETE them
     so nothing imports the old shell/theme. After deleting, run wb-design-audit. -->

# Files to DELETE (superseded — cause the wrong-design conflict)

```
apps/workbench/components/workbench-shell.tsx      # old tab shell → replaced by app-shell.tsx
apps/workbench/components/theme-provider.tsx       # old provider  → replaced by components/theme.tsx
```

After deleting, grep to confirm nothing imports them:

```
git grep -n "workbench-shell\|theme-provider" -- apps/workbench   # must return nothing
```

If anything still imports them, switch the import to:

- `components/app-shell` (AppShell)
- `components/theme` (ThemeProvider, ThemeToggle)
