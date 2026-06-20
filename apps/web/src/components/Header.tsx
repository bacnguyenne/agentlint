import Link from 'next/link';
import { GITHUB_URL } from '@/lib/links';
import { MobileNav } from './MobileNav';

const NAV = [
  { href: '/', label: 'Validator' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/guide', label: 'Guide' },
  { href: '/rules', label: 'Rules' },
  { href: '/templates', label: 'Templates' },
];

/** Top navigation. Server component (no interactivity needed). */
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2 font-semibold text-white">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white shadow-sm"
          >
            ✓
          </span>
          <span className="tracking-tight">
            agent<span className="text-brand-fg">lint</span>
          </span>
        </Link>
        {/* Desktop nav — full inline links. */}
        <nav aria-label="Primary" className="hidden items-center gap-1 text-sm sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden>⭐</span> Star on GitHub
          </a>
        </nav>

        {/* Mobile nav — hamburger menu. */}
        <MobileNav items={NAV} githubUrl={GITHUB_URL} />
      </div>
    </header>
  );
}
