import Link from 'next/link';
import { ApiStatus } from '@/components/api-status';
import { DemoLoginButton } from '@/components/auth/demo-login-button';
import { buttonClasses } from '@/components/ui/button';

const features = [
  {
    title: 'Shelves',
    text: 'Want to read, reading, read — with ratings and reviews.',
  },
  {
    title: 'Catalog',
    text: 'Thousands of books from Open Library with full-text search.',
  },
  {
    title: 'Collections',
    text: 'Curate public lists with shareable link previews.',
  },
  {
    title: 'AI advisor',
    text: 'Recommendations grounded in the real catalog and your shelves.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Shelfwise
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Track what you read. Ask what to read next.
        </h1>
        <p className="max-w-xl text-lg text-muted text-pretty">
          A book-tracking platform with an AI reading advisor that only
          recommends books that actually exist in the catalog.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <DemoLoginButton variant="primary" />
          <Link href="/books" className={buttonClasses('secondary')}>
            Browse the catalog
          </Link>
          <Link href="/register" className={buttonClasses('ghost')}>
            Create an account
          </Link>
        </div>
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          Early scaffold — features land step by step (see docs/roadmap.md)
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f.title} className="rounded-2xl border border-border p-5">
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </li>
        ))}
      </ul>

      <ApiStatus />
    </main>
  );
}
