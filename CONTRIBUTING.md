# Contributing to Gridfinity Layout Tool

Thanks for your interest in Gridfinity Layout Tool! This project is **open source but not open contribution** — code changes are handled by the maintainer to keep development focused and maintainable. That said, community input is valuable and there are several ways to help.

## Ways to Contribute

### Bug Reports

Found something broken? [Open a bug report](https://github.com/andymai/gridfinity-layout-tool/issues/new?template=bug_report.md). Good bug reports include:

- Steps to reproduce the issue
- What you expected vs. what happened
- Browser and device info
- Screenshots or screen recordings if applicable

### Feature Requests

Have an idea? [Open a feature request](https://github.com/andymai/gridfinity-layout-tool/issues/new?template=feature_request.md). Describe the problem you're trying to solve — that context helps more than a specific solution.

### Security Vulnerabilities

See [SECURITY.md](./SECURITY.md) for how to privately report security issues.

## Pull Requests

This project does not accept unsolicited pull requests. PRs opened without prior discussion will be closed — not because the idea is bad, but because features require design consideration and carry a long-term maintenance burden.

If you have a code change you'd like to suggest, please open an issue describing the problem and your proposed approach. If it aligns with the project direction, the maintainer will implement it.

## Running Locally

To run the project locally for testing or verifying a bug report:

```bash
git clone https://github.com/andymai/gridfinity-layout-tool.git
cd gridfinity-layout-tool
nvm use
pnpm install
pnpm run dev
```

The app will be available at `http://localhost:5173`.

### Prerequisites

- **Node.js 24+** (see `.nvmrc` — use `nvm use` to switch)
- **pnpm 10+** (`corepack enable` to install)

## License

This project is licensed under [AGPL-3.0](./LICENSE). By interacting with this project, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).
