# Governance

Orqenix follows a **BDFL-with-public-roadmap** model during the early phases,
with an explicit path toward community governance once the project reaches
maturity.

## Current model, Phases 5 to 7

- **Project Lead (BDFL)**: Milo Nguyen, final call on architecture, license,
  and roadmap.
- **Maintainers**: granted by the Project Lead based on sustained,
  high-quality contributions. Maintainers can merge PRs, triage issues, and
  cut releases.
- **Contributors**: anyone who opens an issue, a PR, or participates in
  Discussions in good faith.

## Decision making

| Type of decision                 | Process                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| Bug fixes, docs, small features  | Any maintainer can approve and merge                            |
| New packages or breaking changes | RFC in Discussions, 7-day comment window, Project Lead approves |
| License changes                  | Project Lead only, must be discussed publicly first             |
| Code of Conduct enforcement      | Code of Conduct committee (currently the Project Lead)          |
| Roadmap shifts                   | RFC in Discussions, Project Lead decides                        |

## Path to community governance

When the project sustains at least 5 active maintainers and a stable release
cadence for 12 months, we will adopt a lightweight Technical Steering
Committee (TSC) model. Draft TSC charter will live in
`docs/governance/tsc-charter-draft.md`.

## Transparency commitments

- All non-security decisions happen in public.
- Monthly maintainer notes published in Discussions.
- Quarterly project updates published as blog posts on `orqenix.dev`.
