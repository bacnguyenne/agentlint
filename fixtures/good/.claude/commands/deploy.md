---
description: Deploy the current branch to staging.
argument-hint: "[environment]"
allowed-tools: Bash(git status:*), Bash(git push:*)
model: sonnet
---

Deploy to the $1 environment. First run the test suite, then push.
