import 'server-only';
import type { Metadata } from 'next';
import { rules, type Severity } from 'agentcheck-core';
import { RULE_CONTENT } from '@/lib/rules-content';
import { RulesExplorer, type RuleEntry } from '@/components/RulesExplorer';

export const metadata: Metadata = {
  title: 'Rules',
  description:
    'Every check agentcheck runs on Claude Code & MCP configuration — grouped by security and correctness, each with a real bad → good example and a one-line fix.',
};

const SEV_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export default function RulesPage() {
  const entries: RuleEntry[] = rules
    .map((r) => ({
      id: r.id,
      severity: r.severity,
      fixable: r.fixable,
      title: r.meta.title,
      description: r.meta.description,
      appliesTo: [...r.appliesTo],
      group: (r.id.startsWith('security/') ? 'security' : 'correctness') as 'security' | 'correctness',
      content: RULE_CONTENT[r.id],
    }))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">What agentcheck checks</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The full rule list: {rules.length} checks for Claude Code &amp; MCP configuration. Open any
          one to see a real example of what fails, what passes, and how to fix it — then try it in the
          validator.
        </p>
      </header>
      <RulesExplorer entries={entries} />
    </div>
  );
}
