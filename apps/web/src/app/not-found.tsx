import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-sm text-brand-fg">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Page not found</h1>
      <p className="mt-3 text-zinc-400">
        That page doesn&apos;t exist — it may have moved, or the link may be out of date.
        Everything on the site is one click away below.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
      >
        Go to validator
      </Link>
      <nav aria-label="All pages" className="mt-8 flex flex-wrap justify-center gap-2">
        {[
          { href: '/catalog', label: 'Catalog', hint: 'skills, MCP servers & tools' },
          { href: '/collections', label: 'Collections', hint: 'the ecosystem on GitHub' },
          { href: '/guide', label: 'Guide', hint: 'how to use it' },
          { href: '/rules', label: 'Rules', hint: 'every check explained' },
          { href: '/templates', label: 'Templates', hint: 'known-good configs' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-zinc-200 transition hover:border-brand-fg/30 hover:bg-white/[0.06] hover:text-white"
          >
            {l.label} <span className="text-xs text-zinc-500">— {l.hint}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
