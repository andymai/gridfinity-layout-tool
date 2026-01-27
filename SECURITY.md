# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing the maintainer directly rather than opening a public issue.

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
