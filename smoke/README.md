# Cross-Repo Smoke Test

## Linux/macOS
```bash
bash smoke/cross-repo-smoke.sh
```

## Windows
```pwsh
./smoke/cross-repo-smoke.ps1
```

## What it checks

1. Sibling layout exists
2. Both repos built
3. v0.4.0-phase-4 tag in both repos
4. Orqenix-Pro test + license-grace pass
5. Orqenix smoke passes
6. Integration suite passes

Exits 0 if all PASS, 1 otherwise.
