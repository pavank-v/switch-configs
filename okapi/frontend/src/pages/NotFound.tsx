import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-5xl font-semibold tracking-tight text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-3 text-lg font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        That page does not exist. It may have been moved or deleted.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
      >
        Back to tasks
      </Link>
    </div>
  );
}
