import type { Severity } from 'agentlint-core';

/** Sort order for severities: errors first, then warnings, then infos. */
export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** Tailwind class bundles per severity, for badges and accents. */
export const SEVERITY_STYLES: Record<
  Severity,
  { badge: string; dot: string; label: string; ring: string }
> = {
  error: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
    label: 'Error',
    ring: 'border-rose-500/30',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    label: 'Warning',
    ring: 'border-amber-500/30',
  },
  info: {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
    label: 'Info',
    ring: 'border-sky-500/30',
  },
};
