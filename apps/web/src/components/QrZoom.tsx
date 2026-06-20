'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

// next/image with `unoptimized` doesn't prefix basePath for a local public asset,
// so reference it explicitly (NEXT_PUBLIC_BASE_PATH is inlined at build time).
const SUPPORT_QR = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/support-qr.jpg`;

/**
 * The support QR: click to zoom into a centered overlay (big enough to scan),
 * click anywhere outside it (or press Escape) to shrink back.
 */
export function QrZoom() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    // Prevent the page scrolling under the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enlarge the VietQR code to scan"
        title="Click to enlarge"
        className="group block shrink-0 cursor-zoom-in rounded-lg"
      >
        <Image
          src={SUPPORT_QR}
          alt="Buy me a coffee — VietQR (VietinBank, NGUYEN DINH NGUYEN BAC)"
          width={112}
          height={112}
          className="rounded-lg border border-white/10 bg-white p-1 transition group-hover:scale-[1.03] group-hover:border-brand-fg/40"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Coffee QR code"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex animate-fade-in cursor-zoom-out flex-col items-center justify-center gap-4 bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-[min(85vw,360px)]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={SUPPORT_QR}
              alt="Buy me a coffee — VietQR (VietinBank, NGUYEN DINH NGUYEN BAC)"
              width={360}
              height={360}
              className="h-auto w-full rounded-2xl border border-white/10 bg-white p-3 shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -right-3 -top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-ink text-white shadow-lg transition hover:bg-white/10"
            >
              ✕
            </button>
            <p className="mt-3 text-center text-sm text-zinc-200">
              Scan to support via VietQR (VietinBank)
            </p>
            <p className="text-center text-xs text-zinc-400">NGUYEN DINH NGUYEN BAC · 109875964393</p>
          </div>
          <p className="text-xs text-zinc-400">Click anywhere to close</p>
        </div>
      )}
    </>
  );
}
