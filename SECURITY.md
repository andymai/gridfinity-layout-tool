# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, use [GitHub's private vulnerability reporting](https://github.com/andymai/gridfinity-layout-tool/security/advisories/new) to submit your report.

**Please include:**

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You can expect an initial response within 48 hours.

## Supported Versions

Only the latest version deployed at [gridfinitylayouttool.com](https://gridfinitylayouttool.com) is actively supported.

## Security Measures

This project implements:

- Rate limiting on API endpoints
- Input validation and sanitization
- Content filtering for user-generated data
- No storage of sensitive user data
- All secrets externalized via environment variables

## Supply Chain

In response to the 2025–2026 wave of npm and GitHub Actions supply-chain
attacks (Shai-Hulud worm, chalk/debug compromise, tj-actions tag retag,
prt-scan AI campaign, durabletask PyPI poisoning), the build is configured
to fail closed on the patterns those attacks exploited:

| Defense                                                  | Where                                      | What it blocks                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `minimumReleaseAge: 10080` (7d cooldown)                 | `pnpm-workspace.yaml`                      | Fresh malicious uploads — most are detected & taken down within hours. Would have blocked axios, chalk/debug, durabletask. |
| `ignoreScripts: true` + `allowBuilds` allowlist          | `pnpm-workspace.yaml`                      | Postinstall / lifecycle script execution by default. This is the Shai-Hulud worm's primary spread vector.                  |
| All GitHub Actions pinned to commit SHA                  | `.github/workflows/*.yml`                  | Tag-retag attacks (tj-actions class). Tags are mutable; commit SHAs are not.                                               |
| `pull_request_target` workflows never `checkout` PR code | `.github/workflows/{labeler,pr-title}.yml` | Pwn requests — fork PR code running with write-token in base context.                                                      |
| OSV scan (PRs report-only, main blocking)                | `.github/workflows/osv-scan.yml`           | Known-CVE versions in the lockfile.                                                                                        |
| Dependabot cooldown (7d / 14d major)                     | `.github/dependabot.yml`                   | Dependabot suggesting fresh-from-publish versions that would fail install anyway.                                          |
| CodeQL analysis                                          | `.github/workflows/codeql.yml`             | First-party code vulns.                                                                                                    |

**Cooldown exclusions** are deliberate and listed in
[`pnpm-workspace.yaml`](pnpm-workspace.yaml) under `minimumReleaseAgeExclude`.
They cover user-authored packages (no security benefit from delaying our own
releases) and high-trust org scopes that release frequently and lockstep.
Security fixes younger than the cutoff are admitted by pinning the exact
reviewed version with a dated TODO, never a bare package name.

Exempting two versions of the **same** package requires a single `||` union
entry (`pkg@1.1.17||5.0.8`). pnpm returns the first rule whose name matches and
never unions across list entries, so a second line for that package is silently
dead and its version stays blocked — with no warning that the entry did nothing.

**OSV findings are not suppressed.** There is deliberately no `osv-scanner.toml`.
A finding we can't fix yet stays red rather than being silenced, and "the
advisory looks wrong" is not grounds for an exception — verify it by running the
advisory's proof-of-concept against the installed version before believing it.

**Currently open:** `brace-expansion@1.1.17` (CVE-2026-14257, High, build-time
devDependency only — `pnpm why brace-expansion --prod` is empty, so it is never
shipped to users) — **reported but not exploitable; the installed version carries
the fix.**

Upstream backported the fix to the 1.x line as 1.1.17 on 2026-07-29. `minimatch@3`
— still pinned by `eslint-plugin-jsx-a11y`, which calls minimatch as a function, an
API minimatch@10 dropped — declares `^1.1.7`, so it takes 1.1.17 without the
minimatch@10 migration that previously looked like the only exit. Verified with the
advisory's own PoC (`'{a,b}'.repeat(1500)` under `--max-old-space-size=512`): 1.1.17
returns a bounded 2666 items, 1.1.16 dies with a heap OOM. 1.1.16 did define an
`EXPANSION_MAX_LENGTH` constant, but the bound was ineffective — which is why that
marker is not evidence of a fix.

GHSA-mh99-v99m-4gvg declares a single range, `introduced: 0` → `fixed: 5.0.8`, with
no per-line fixed events, so it sweeps in every backport below 5.0.8 (1.1.17, 2.1.3,
3.0.3). The scan therefore stays red on a version that is genuinely patched. A range
correction is filed upstream as github/advisory-database#8877. Per the
no-suppression rule above this is left red rather than silenced; the fix is an
upstream correction to the advisory's ranges, not an `osv-scanner.toml`.

**Adding a build script allow-list entry** (`allowBuilds`) is a security
decision. Audit the package's postinstall behavior before adding.

**External advisory monitoring:** the
[Socket GitHub App](https://github.com/marketplace/socket-security) is
installed for behavioral analysis of new dependency PRs. Findings appear
inline on PR diffs.
