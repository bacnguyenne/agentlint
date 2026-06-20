'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Finding, LintResult } from 'agentlint-core';
import {
  KIND_META,
  SELECTABLE_KINDS,
  detectKind,
  pathForKind,
  type SelectableKind,
} from '@/lib/detect-kind';
import { EXAMPLES } from '@/lib/examples';
import { RULE_CONTENT } from '@/lib/rules-content';
import { SEVERITY_ORDER, SEVERITY_STYLES } from './severity';
import { MAX_TOTAL_INPUT_BYTES } from '@/lib/config';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: LintResult }
  | { kind: 'error'; message: string };

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Group findings by severity, each group sorted by line then column. */
function groupBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const ln = (a.line ?? 0) - (b.line ?? 0);
    if (ln !== 0) return ln;
    return (a.column ?? 0) - (b.column ?? 0);
  });
}

export function Validator() {
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<SelectableKind>('claudemd');
  const [autoKind, setAutoKind] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Abort any in-flight validation request when the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Deep-link from /rules: `/?try=<ruleId>` preloads that rule's "bad" example
  // so the user lands on the validator with a config that demonstrates the rule.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('try');
    if (!id) return;
    const ex = RULE_CONTENT[id]?.bad;
    if (!ex) return;
    setContent(ex.content);
    setKind(ex.kind);
    setAutoKind(false);
    setStatus({ kind: 'idle' });
  }, []);

  const byteSize = useMemo(() => utf8Bytes(content), [content]);
  const overLimit = byteSize > MAX_TOTAL_INPUT_BYTES;

  const detected = useMemo(() => detectKind(content), [content]);
  const effectiveKind: SelectableKind = autoKind ? detected : kind;

  const onContentChange = useCallback((value: string) => {
    setContent(value);
    setStatus({ kind: 'idle' });
  }, []);

  const onPickExample = useCallback((id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setContent(ex.content);
    setAutoKind(false);
    setKind(ex.kind);
    setStatus({ kind: 'idle' });
  }, []);

  const onFile = useCallback(async (file: File) => {
    if (file.size > MAX_TOTAL_INPUT_BYTES) {
      setStatus({
        kind: 'error',
        message: `File too large (max ${Math.floor(MAX_TOTAL_INPUT_BYTES / 1024)} KiB).`,
      });
      return;
    }
    const text = await file.text();
    setContent(text);
    setAutoKind(true);
    setStatus({ kind: 'idle' });
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim()) {
        setStatus({ kind: 'error', message: 'Paste or upload a config first.' });
        return;
      }
      if (overLimit) {
        setStatus({
          kind: 'error',
          message: `Input too large (max ${Math.floor(MAX_TOTAL_INPUT_BYTES / 1024)} KiB).`,
        });
        return;
      }
      // Abort any in-flight request before starting a new one so a slow earlier
      // submission can't overwrite the result of a newer one (race condition).
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus({ kind: 'loading' });
      // On narrow screens the results panel sits well below the textarea; bring
      // it into view so tapping Validate produces a visible change immediately.
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      try {
        // Lint entirely in the browser — agentlint-core is pure JS, so nothing is
        // sent to a server and the app can ship as a fully static site. Lazy-loaded
        // so the engine isn't in the initial bundle.
        const { lintClientSide } = await import('@/lib/lint-client');
        const result = lintClientSide([
          { path: pathForKind(effectiveKind), content, kind: effectiveKind },
        ]);
        setStatus({ kind: 'done', result });
      } catch (err) {
        if (err instanceof Error && err.name === 'InputTooLargeError') {
          setStatus({ kind: 'error', message: 'Input too large.' });
          return;
        }
        setStatus({ kind: 'error', message: 'Could not validate the input.' });
      }
    },
    [content, effectiveKind, overLimit],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input panel */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="kind" className="text-sm font-medium text-zinc-300">
              File kind
            </label>
            <select
              id="kind"
              value={effectiveKind}
              onChange={(e) => {
                setAutoKind(false);
                setKind(e.target.value as SelectableKind);
                setStatus({ kind: 'idle' });
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
            >
              {SELECTABLE_KINDS.map((k) => (
                <option key={k} value={k} className="bg-ink-soft">
                  {KIND_META[k].label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={autoKind}
                onChange={(e) => setAutoKind(e.target.checked)}
                className="accent-brand"
              />
              auto-detect
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.json,.txt,text/markdown,application/json,text/plain"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Upload file
            </button>
          </div>
        </div>

        <div className="relative">
          <label htmlFor="config" className="sr-only">
            Configuration content
          </label>
          <textarea
            id="config"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            spellCheck={false}
            placeholder="Paste your CLAUDE.md, subagent, slash command, settings.json, or .mcp.json here…"
            className="scroll-thin h-[420px] w-full resize-y rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600"
          />
          <div className="pointer-events-none absolute bottom-3 right-3 text-xs text-zinc-500">
            <span className={overLimit ? 'text-rose-400' : ''}>
              {(byteSize / 1024).toFixed(1)} / {Math.floor(MAX_TOTAL_INPUT_BYTES / 1024)} KiB
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={status.kind === 'loading' || overLimit}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.kind === 'loading' ? 'Validating…' : 'Validate'}
          </button>
          <button
            type="button"
            onClick={() => {
              setContent('');
              setStatus({ kind: 'idle' });
              setAutoKind(true);
            }}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Clear
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Try an example:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                title={ex.description}
                onClick={() => onPickExample(ex.id)}
                className={
                  ex.clean
                    ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20'
                    : 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white'
                }
              >
                {ex.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            The broken examples are intentional — each red finding is agentlint catching a real problem.
          </p>
        </div>
      </form>

      {/* Results panel — the header row mirrors the input's controls row height so
          the results box top-aligns with the textarea (otherwise it sits ~1 row high). */}
      <div ref={resultsRef} className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        <div className="mb-4 flex min-h-[34px] flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">Results</span>
        </div>
        <ResultsPanel status={status} />
      </div>
    </div>
  );
}

function ResultsPanel({ status }: { status: Status }) {
  if (status.kind === 'idle') {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-8 text-center">
        <p className="text-sm text-zinc-400">
          Results appear here. Paste a config and press{' '}
          <span className="font-medium text-zinc-200">Validate</span>.
        </p>
      </div>
    );
  }

  if (status.kind === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-white/10 p-8"
      >
        <p className="animate-pulse text-sm text-zinc-400">Validating…</p>
      </div>
    );
  }

  if (status.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200"
      >
        {status.message}
      </div>
    );
  }

  const { result } = status;
  const { summary } = result;
  const sorted = groupBySeverity(result.findings);
  const clean = result.findings.length === 0;

  return (
    <div role="status" aria-live="polite" className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
        <SummaryStat n={summary.errors} label="errors" tone="error" />
        <SummaryStat n={summary.warnings} label="warnings" tone="warning" />
        <SummaryStat n={summary.infos} label="infos" tone="info" />
        <span className="ml-auto text-xs text-zinc-500">
          {summary.filesChecked} {summary.filesChecked === 1 ? 'file' : 'files'} checked
        </span>
      </div>

      {clean ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
          <span aria-hidden className="text-3xl">
            ✓
          </span>
          <p className="text-base font-semibold text-emerald-200">No problems found</p>
          <p className="text-sm text-emerald-300/80">
            This configuration passes every agentlint rule.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="findings">
          {sorted.map((f, i) => (
            <FindingCard
              key={`${f.ruleId}:${f.line ?? 'x'}:${f.column ?? 'x'}:${i}`}
              finding={f}
            />
          ))}
        </ul>
      )}

      <NextStep clean={clean} fixable={result.findings.filter((f) => f.fixable).length} />
    </div>
  );
}

/**
 * Turns a one-off web check into the repeated value: a clean result points to
 * `npx agentlint` / CI; a result with fixable findings points to `--fix`.
 */
function NextStep({ clean, fixable }: { clean: boolean; fixable: number }) {
  const Code = ({ children }: { children: string }) => (
    <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-zinc-200">{children}</code>
  );
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
      {clean ? (
        <p>
          Want this enforced automatically? Run <Code>npx agentlint</Code> in your repo, or add it
          to CI so a bad config fails the build.
        </p>
      ) : (
        <p>
          {fixable > 0 && (
            <>
              {fixable} of these {fixable === 1 ? 'is' : 'are'} auto-fixable — run{' '}
              <Code>npx agentlint --fix</Code>.{' '}
            </>
          )}
          Run <Code>npx agentlint</Code> to check your whole repo, or add it to CI.
        </p>
      )}
    </div>
  );
}

function SummaryStat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: 'error' | 'warning' | 'info';
}) {
  const s = SEVERITY_STYLES[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      <span className="font-semibold text-white">{n}</span>
      <span className="text-zinc-400">{label}</span>
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const s = SEVERITY_STYLES[finding.severity];
  const loc =
    finding.line != null
      ? `${finding.line}${finding.column != null ? `:${finding.column}` : ''}`
      : '—';
  return (
    <li className={`rounded-xl border bg-white/[0.03] p-4 ${s.ring}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
          {s.label}
        </span>
        <code className="font-mono text-xs text-zinc-400">{loc}</code>
        <a
          href={`/rules#${encodeURIComponent(finding.ruleId)}`}
          className="font-mono text-xs text-brand-fg hover:underline"
        >
          {finding.ruleId}
        </a>
        {finding.fixable && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
            fixable
          </span>
        )}
      </div>
      {/* User content is rendered as plain text only — never as HTML. */}
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{finding.message}</p>
    </li>
  );
}
