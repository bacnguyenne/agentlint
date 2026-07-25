/**
 * Catalog **bundles** — the catalog grouped by what you are trying to DO, not by
 * file type. "I'm building a web app" / "I need to work with Office documents" /
 * "I want a security review" each map to one bundle you can install with a single
 * command or download as one zip.
 *
 * Membership is RULE-BASED (a predicate over the item, plus an explicit id/name
 * list) rather than a frozen list of ids, because the catalog is re-synced weekly
 * by `scripts/sync-skills.mjs` — new upstream items land in the right bundle
 * without anyone editing this file. An item may belong to several bundles (the
 * `postgres` MCP server is useful to both "Data" and "Backend").
 */
import { CATALOG, type CatalogItem } from './catalog';

export interface Bundle {
  id: string;
  /** Short human name shown on the card. */
  label: string;
  /** Emoji marker — decorative only (aria-hidden at the call site). */
  icon: string;
  /** One line: what this bundle is for. */
  blurb: string;
  /** When you'd reach for it — shown once the bundle is open. */
  useWhen: string;
  /** Names/ids always included, regardless of the pattern below. */
  include?: string[];
  /** Matched against `name` and `id` — the bulk of the membership rule. */
  pattern?: RegExp;
  /** Escape hatch for items the pattern over-captures. */
  exclude?: RegExp;
}

/**
 * Ordered by how commonly people need them (essentials first). Keep each blurb
 * to one line — a bundle nobody can describe in one line is really two bundles.
 */
export const BUNDLES: Bundle[] = [
  {
    id: 'essentials',
    label: 'Everyday essentials',
    icon: '🧰',
    blurb: 'The starter set: git hygiene, shipping a feature, releases, and the reference docs an agent needs.',
    useWhen: 'Start here if you have never installed a skill. Small, safe, useful on every project.',
    include: [
      'conventional-commits', 'git-advanced-workflows', 'ship-feature', 'cut-release',
      'skill-creator', 'claude-api', 'debugging-strategies', 'code-review-excellence',
      'git', 'github', 'filesystem', 'context7', 'sequential-thinking', 'memory',
    ],
  },
  {
    id: 'web-frontend',
    label: 'Web & frontend',
    icon: '🖥️',
    blurb: 'React/Next.js patterns, design systems, visual checks and browser automation.',
    useWhen: 'Building or modernising a web UI — components, styling, responsive layout, visual QA.',
    pattern: /(react|nextjs|frontend|tailwind|angular|web-artifacts|webapp-testing|brand-landingpage|ui-visual)/i,
    include: ['frontend-design', 'theme-factory', 'playwright', 'puppeteer', 'context7'],
  },
  {
    id: 'backend-api',
    label: 'Backend & APIs',
    icon: '🔌',
    blurb: 'API design, endpoint scaffolding, error handling and backend architecture reviewers.',
    useWhen: 'Designing or building a service: REST/GraphQL endpoints, contracts, backend structure.',
    pattern: /(api-design|api-endpoint|api-scaffolding|backend-development|backend-architect|openapi|fastapi|dotnet-backend|graphql|error-handling)/i,
    include: ['microservices-patterns', 'postgres', 'sqlite', 'sentry'],
  },
  {
    id: 'data-db',
    label: 'Data & databases',
    icon: '🗄️',
    blurb: 'Schema design, SQL tuning, migrations, pipelines and warehouse transformations.',
    useWhen: 'Working with a database or data pipeline — modelling, query performance, migrations, dbt/Spark/Airflow.',
    pattern: /(database|postgresql|sql-|sql-pro|dbt|spark|airflow|data-engineer|data-quality|data-storytelling|kpi-dashboard)/i,
    include: ['postgres', 'mongodb', 'sqlite', 'supabase'],
  },
  {
    id: 'devops-cloud',
    label: 'DevOps & cloud',
    icon: '☁️',
    blurb: 'CI/CD pipelines, Terraform, Kubernetes, service mesh and multi-cloud networking.',
    useWhen: 'Shipping and running the thing: pipelines, infrastructure as code, clusters, rollout and observability.',
    pattern: /(cicd|deployment|terraform|kubernetes|cloud-infrastructure|hybrid-cloud|multi-cloud|istio|service-mesh|mtls|github-actions|gitlab-ci|bazel|turborepo|nx-workspace|monorepo|dependency-upgrade|upgrade-dependencies|cost-optimization|observability|network-engineer)/i,
    include: ['git', 'github', 'sentry'],
  },
  {
    id: 'testing-qa',
    label: 'Testing & debugging',
    icon: '🧪',
    blurb: 'TDD, end-to-end tests, incident triage and structured debugging.',
    useWhen: 'Adding tests, chasing a failing test, or setting up an end-to-end suite.',
    pattern: /(tdd|test-automator|e2e-testing|debug|debugging|temporal-python-testing|web3-testing|team-debugger|incident)/i,
    include: ['playwright', 'puppeteer', 'sentry'],
  },
  {
    id: 'security',
    label: 'Security & compliance',
    icon: '🔐',
    blurb: 'Secure coding, secret handling, auth patterns and security-focused reviewers.',
    useWhen: 'Before a launch, during a security review, or when touching auth, secrets or user data.',
    pattern: /(secure-coding|security|secrets-management|auth-implementation|solidity-security|data-validation)/i,
    include: ['production-readiness'],
  },
  {
    id: 'review-quality',
    label: 'Code review & quality',
    icon: '🔍',
    blurb: 'PR review, refactoring, cleanup and production-readiness checks.',
    useWhen: 'Reviewing someone else’s change, cleaning up a codebase, or gating a release.',
    pattern: /(review-pr|code-review|multi-reviewer|comprehensive-review|code-refactoring|codebase-cleanup|legacy-modernizer|architect-review|production-readiness|optimize-performance|performance-engineer)/i,
  },
  {
    id: 'docs-office',
    label: 'Documents & office',
    icon: '📄',
    blurb: 'Word, PowerPoint, Excel and PDF handling, plus documentation writing.',
    useWhen: 'Reading or producing real office files, reports and project documentation.',
    pattern: /(docx|pptx|xlsx|pdf|doc-coauthoring|documentation|docs-architect|tutorial-engineer|internal-comms|changelog)/i,
    include: ['notion', 'filesystem'],
  },
  {
    id: 'design-brand',
    label: 'Design & brand',
    icon: '🎨',
    blurb: 'Visual design guidance, brand systems, canvases and generative art.',
    useWhen: 'Making something look intentional: brand application, design tokens, visuals and illustrations.',
    pattern: /(brand|canvas-design|algorithmic-art|theme-factory|slack-gif|frontend-design|tailwind-design)/i,
  },
  {
    id: 'business-content',
    label: 'Business & content',
    icon: '📈',
    blurb: 'Financial models, KPI dashboards, marketing copy, sales and support workflows.',
    useWhen: 'Non-engineering work: analysis, reporting, marketing content, customer communication.',
    pattern: /(financial|business-analyst|content-marketer|sales-automator|customer-support|kpi-dashboard|data-storytelling)/i,
    include: ['stripe', 'linear', 'slack', 'notion'],
  },
  {
    id: 'research-web',
    label: 'Research & web access',
    icon: '🔎',
    blurb: 'Search, scraping, documentation lookup and long-running reasoning aids.',
    useWhen: 'Your agent needs facts from the internet or up-to-date library documentation.',
    include: [
      'search-specialist', 'brave-search', 'exa', 'tavily', 'firecrawl', 'fetch',
      'context7', 'sequential-thinking', 'memory', 'time',
    ],
  },
  {
    id: 'architecture',
    label: 'Architecture & planning',
    icon: '🏗️',
    blurb: 'Decision records, C4 diagrams, event sourcing, CQRS and migration planning.',
    useWhen: 'Deciding how a system should be shaped — and writing that decision down.',
    pattern: /(architecture|c4-|cqrs|event-store|event-sourcing|saga|projection|microservices|plan-to-production|context-driven-development)/i,
  },
  {
    id: 'team-orchestration',
    label: 'Teams & orchestration',
    icon: '🧭',
    blurb: 'Multi-agent coordination, parallel work, and team-shaped subagents.',
    useWhen: 'Running several agents at once, or splitting a big change into parallel tracks.',
    pattern: /(team-|task-coordination|parallel-|workflow-orchestration|workflow-patterns|agent-orchestration|context-manager|conductor|track-management)/i,
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: '♿',
    blurb: 'WCAG audits, screen-reader testing and visual validation.',
    useWhen: 'Making sure real people — including assistive-tech users — can actually use your UI.',
    pattern: /(wcag|screen-reader|accessib|ui-visual-validator)/i,
  },
  {
    id: 'web3',
    label: 'Web3 & blockchain',
    icon: '⛓️',
    blurb: 'Solidity security, NFT standards, DeFi templates and chain testing.',
    useWhen: 'Writing or auditing smart contracts and on-chain integrations.',
    pattern: /(solidity|nft|defi|web3|blockchain)/i,
  },
];

/** Does `item` belong to `bundle`? */
export function inBundle(item: CatalogItem, bundle: Bundle): boolean {
  if (bundle.include?.includes(item.name) || bundle.include?.includes(item.id)) return true;
  if (!bundle.pattern) return false;
  const hay = `${item.name} ${item.id}`;
  if (bundle.exclude?.test(hay)) return false;
  return bundle.pattern.test(hay);
}

/** The items in a bundle, kind-ordered (skills, then tools, then MCP servers). */
export function bundleItems(bundle: Bundle, items: CatalogItem[] = CATALOG): CatalogItem[] {
  const rank = { skill: 0, tool: 1, mcp: 2 } as const;
  return items
    .filter((i) => inBundle(i, bundle))
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
}

/** id → member count, for the bundle cards. */
export const BUNDLE_COUNTS: Record<string, number> = Object.fromEntries(
  BUNDLES.map((b) => [b.id, bundleItems(b).length]),
);

/** Items no bundle claims — surfaced as "Everything else" so nothing hides. */
export function unbundledItems(items: CatalogItem[] = CATALOG): CatalogItem[] {
  return items.filter((i) => !BUNDLES.some((b) => inBundle(i, b)));
}

/** One command that installs a whole bundle (the CLI accepts several ids). */
export function bundleInstallCommand(bundle: Bundle, items: CatalogItem[] = CATALOG): string {
  const ids = bundleItems(bundle, items).map((i) => i.id);
  return ids.length > 0 ? `npx agentcheck add ${ids.join(' ')}` : '';
}
