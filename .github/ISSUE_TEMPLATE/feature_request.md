---
name: Feature request / new rule
about: Suggest a new rule or an improvement to agentlint
title: "[feat] "
labels: enhancement
assignees: ''
---

## What would you like agentlint to do?

A clear description of the feature or the new rule.

## Is this a new rule?

If so:

- **Proposed id:** `group/kebab-name` (group = agent | command | settings | mcp | security | core)
- **Severity:** error | warning | info
- **Fixable?** yes / no
- **What it catches:** the misconfiguration or security issue.

### Example that should be flagged

```text
<the config that should trigger the rule — redact real secrets>
```

### Example that should NOT be flagged (false-positive guard)

```text
<a valid config that looks similar but is fine>
```

## Why is this valuable?

The real-world bug or risk this prevents.

## Additional context

Links to Claude Code / MCP docs, prior art, etc.
