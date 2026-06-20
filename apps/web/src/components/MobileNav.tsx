'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

/** Mobile-only hamburger menu (the desktop nav is shown inline at sm+). */
export function MobileNav({
  items,
  githubUrl,
  blogUrl,
}: {
  items: NavItem[];
  githubUrl: string;
  blogUrl: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[57px] z-30 cursor-default bg-black/40"
          />
          <nav
            aria-label="Mobile"
            className="absolute left-0 right-0 top-full z-40 border-b border-white/10 bg-ink/95 px-4 py-2 shadow-lg backdrop-blur"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={blogUrl}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/5 hover:text-white"
            >
              Blog
            </a>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-md px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5 hover:text-white"
            >
              ⭐ Star on GitHub
            </a>
          </nav>
        </>
      )}
    </div>
  );
}
