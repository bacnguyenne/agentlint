import type { SelectableKind } from './detect-kind';

/**
 * Deliberately-broken sample configs for the "try an example" buttons. Each is
 * crafted to trip specific rules so users immediately see agentlint working.
 */
export interface Example {
  id: string;
  label: string;
  description: string;
  kind: SelectableKind;
  content: string;
  /** A config that PASSES every rule — shown first so users see a green ✓ result, not only red. */
  clean?: boolean;
}

export const EXAMPLES: Example[] = [
  {
    id: 'clean-settings',
    label: 'Clean settings.json (passes ✓)',
    description: 'A valid, secure settings.json — agentlint reports zero problems.',
    kind: 'settings',
    clean: true,
    content: `{
  "permissions": {
    "allow": ["Bash(git status:*)", "Read", "Edit"],
    "deny": ["Bash(rm:*)"]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo running" }] }
    ]
  },
  "model": "sonnet"
}
`,
  },
  {
    id: 'bad-settings-hooks',
    label: 'Broken hooks (settings.json)',
    description: 'Legacy array-form hooks, object matcher, and a dangerous command.',
    kind: 'settings',
    content: `{
  "hooks": [
    {
      "matcher": { "toolName": "Bash" },
      "hooks": [
        { "type": "command", "command": "rm -rf / --no-preserve-root" }
      ]
    }
  ],
  "permissions": { "allow": ["Bash(*)", "*"] },
  "model": "claude-3-5-sonnet-latest"
}
`,
  },
  {
    id: 'bad-mcp-secret',
    label: 'Leaked secret (.mcp.json)',
    description: 'An http server with a hardcoded token plus an unpinned npx package.',
    kind: 'mcp',
    content: `{
  "mcpServers": {
    "remote-api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer sk-ant-api03-9f8e7d6c5b4a3210JmK2pQ7rT4vX1zN8wL5yB" }
    },
    "tools": {
      "command": "npx",
      "args": ["-y", "@some/mcp-server"]
    }
  }
}
`,
  },
  {
    id: 'bad-agent',
    label: 'Invalid subagent',
    description: 'Bad name, missing description, invalid model, empty body.',
    kind: 'agent',
    content: `---
name: My Agent!
model: gpt-4o
tools: Read, Write, Frobnicate
---
`,
  },
  {
    id: 'clean-skill',
    label: 'Clean skill (passes ✓)',
    description: 'A valid Agent Skill — name matches the directory, a "Use when…" description, scoped tools.',
    kind: 'skill',
    clean: true,
    content: `---
name: my-skill
description: Summarize a folder of Markdown notes into a short brief. Use when the user asks to summarize or digest their notes.
allowed-tools: Read, Glob
---

# My Skill

Read the Markdown notes in the target folder and produce a concise summary.
`,
  },
  {
    id: 'bad-skill',
    label: 'Invalid skill (SKILL.md)',
    description: 'Bad name, no trigger in the description, a typo\'d key, broad tool access, empty body.',
    kind: 'skill',
    content: `---
name: My_Skill
description: helps with stuff
allowed_tools: Bash(*)
extra-key: nope
---
`,
  },
];

export function exampleById(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
