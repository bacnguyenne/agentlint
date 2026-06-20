import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-sm text-brand-fg">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Page not found</h1>
      <p className="mt-3 text-zinc-400">
        That page doesn&apos;t exist. Head back to the validator to check a config.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
      >
        Go to validator
      </Link>
    </div>
  );
}
