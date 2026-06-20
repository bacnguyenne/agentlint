# Security Policy

agentlint is a tool you run on *configuration that may contain secrets*, so its own security posture matters. This document describes that posture and how to report a vulnerability.

> agentlint is **unofficial** and not affiliated with Anthropic.

## The tool's security model

agentlint is designed to be safe to run on untrusted input:

- **It never executes, imports, `eval`s, or network-fetches user-provided content.** It only **parses** files (YAML frontmatter, JSON) and runs static checks. There is no code path that runs a hook command, fetches a URL, or imports a discovered file.
- **No telemetry, no network calls, no account.** The CLI and core do not phone home.
- **Inputs are size-capped** (per-file cap in the engine; the web `/api/lint` route caps total body size and file count) to bound memory and regex work.
- **All regexes are ReDoS-safe** (bounded, no catastrophic backtracking) and are tested against pathological inputs.
- **Secrets are redacted** in finding messages — agentlint reports *that* a secret exists and its kind, not the secret value.
- **The web app** ships strict security headers (a per-request nonce'd Content-Security-Policy, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, COOP/CORP, restrictive `Permissions-Policy`), validates and rate-limits requests, stores nothing, and the Docker image runs as a **non-root** user.

The codebase has been security-audited, including the discovery and fix of a **prototype-pollution** bug in the tolerant JSON parser. `npm audit --omit=dev` reports 0 production vulnerabilities (the only advisories are 2 low-severity, dev-only, in the ESLint toolchain).

## Supported versions

agentlint follows semantic versioning. Security fixes are released for the latest minor of the current major.

| Version | Supported |
|---|---|
| `1.x` (latest) | ✅ |
| `< 1.0` | ❌ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately via one of:

1. **GitHub Security Advisories** (preferred): open a private report at
   `https://github.com/bacnguyenne/agentlint/security/advisories/new`.
2. Or email the maintainer (see the GitHub profile for `bacnguyenne`).

Please include:

- a description of the issue and its impact,
- steps to reproduce (a minimal config / request that triggers it),
- affected version(s), and
- any suggested remediation.

### What to expect

- We aim to **acknowledge** your report within **5 business days**.
- We'll work with you on a fix and a coordinated disclosure timeline (typically up to **90 days**).
- With your permission, we'll credit you in the release notes / advisory.

Thank you for helping keep agentlint and its users safe.
