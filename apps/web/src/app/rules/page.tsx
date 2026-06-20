import 'server-only';
import type { Metadata } from 'next';
import { rules, type Severity } from 'agentlint-core';
import { RULE_CONTENT } from '@/lib/rules-content';
import { RulesExplorer, type RuleEntry } from '@/components/RulesExplorer';

export const metadata: Metadata = {
  title: 'Rules',
  description:
    'Every check agentlint runs on Claude Code & MCP configuration — grouped by security and correctness, each with a real bad → good example and a one-line fix.',
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
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">What agentlint checks</h1>
        <p className="mt-2 text-zinc-400">
          {rules.length} checks for Claude Code &amp; MCP configuration — each with a real bad → good
          example you can run in one click.
        </p>
      </header>
      <RulesExplorer entries={entries} />
    </div>
  );
}
