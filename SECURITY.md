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

**Adding a build script allow-list entry** (`allowBuilds`) is a security
decision. Audit the package's postinstall behavior before adding.

**External advisory monitoring:** the
[Socket GitHub App](https://github.com/marketplace/socket-security) is
installed for behavioral analysis of new dependency PRs. Findings appear
inline on PR diffs.
