---
name: Bug report
about: Report incorrect behavior in agentcheck (wrong finding, missed finding, crash, bad fix)
title: "[bug] "
labels: bug
assignees: ''
---

<!--
For SECURITY vulnerabilities, do NOT open a public issue — see SECURITY.md.
-->

## What happened

A clear description of the bug.

## Which part

- [ ] `agentcheck-core` (engine / a rule)
- [ ] `agentcheck` CLI
- [ ] `@agentcheck/web` (validator)

## Rule id (if applicable)

e.g. `security/hardcoded-secret`

## Minimal reproduction

The smallest config that triggers it. **Redact any real secrets** before pasting.

```text
<paste the offending CLAUDE.md / settings.json / .mcp.json / agent / command here>
```

Command run (if CLI):

```bash
npx @bacnguyenne/agentcheck ...
```

## Expected behavior

What you expected agentcheck to report (or not report).

## Actual behavior

What it actually did. Paste the `--format json` output if relevant.

## Environment

- agentcheck version: `npx @bacnguyenne/agentcheck --version`
- Node version: `node --version`
- OS:

## Additional context

Anything else that helps.
