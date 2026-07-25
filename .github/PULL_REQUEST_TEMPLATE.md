<!--
Thanks for contributing to agentcheck! Please read CONTRIBUTING.md first.
Use a Conventional Commit title, e.g. "feat(core): add settings/hook-timeout rule".
-->

## Summary

What does this PR change and why?

## Type of change

- [ ] New rule
- [ ] Bug fix
- [ ] Feature / improvement
- [ ] Docs
- [ ] Refactor / chore / CI

## If this adds or changes a rule

- **Rule id:** `group/kebab-name`
- [ ] Registered in `packages/core/src/rules/index.ts`
- [ ] Added a triggering fixture (`fixtures/bad/...`) and verified `fixtures/good/...` stays clean
- [ ] Added a triggering test **and** a clean test
- [ ] Security rules: added false-positive coverage
- [ ] Fixable rules: added an autofix idempotency test
- [ ] Updated `docs/RULES.md`

## Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run test -w agentcheck-core` passes
- [ ] `npm run test -w agentcheck` passes
- [ ] Web changes: `npm run test -w @agentcheck/web` (+ e2e if relevant) pass
- [ ] No new runtime deps added to `agentcheck-core` / `agentcheck` without discussion
- [ ] No code path executes, imports, evals, or network-fetches user content
- [ ] Docs updated (README / RULES / package READMEs) where behavior changed
- [ ] Commits follow Conventional Commits

## Related issues

Closes #
