---
name: release-notes
description: Draft release notes from merged pull requests. Use when preparing a release or when the user asks for a changelog.
license: MIT
allowed-tools: Read, Bash(git log:*)
---

# Release Notes

Produce concise, user-facing release notes for the changes since the last tag.

## Process

1. Collect merged PRs: `git log --merges <last-tag>..HEAD`.
2. Group entries under Added / Changed / Fixed.
3. Write one line per change in the imperative mood; link the PR number.

Never include internal-only notes or secrets in the output.
