import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import { LogoutIcon, MoonIcon, OkapiMark, SettingsIcon, SunIcon } from '@/components/icons';
import { cx } from '@/components/ui';
import { displayName, initials, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="grid size-9 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
    >
      {theme === 'dark' ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
    </button>
  );
}

function AccountMenu() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!account) {
    return null;
  }

  return (
    <div ref={container} className="relative">
      <button
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-[var(--surface-hover)]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white dark:bg-brand-500 dark:text-brand-950">
          {initials(account)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{displayName(account)}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="surface-card animate-rise absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl2 p-1.5"
        >
          <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
            <p className="truncate text-sm font-medium">{displayName(account)}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
          </div>
          <NavLink
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
          >
            <SettingsIcon className="size-4" />
            Account settings
          </NavLink>
          <button
            role="menuitem"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
          >
            <LogoutIcon className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--surface-page)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg">
            <OkapiMark className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">Okapi</span>
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 py-6 text-center text-xs text-faint sm:px-6">
        Okapi — React &amp; Spring Boot, backed by PostgreSQL.
      </footer>
    </div>
  );
}

/** Centred shell used by the sign-in and sign-up screens. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-aurora relative isolate flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[25rem]">
        <div className="mb-7 flex flex-col items-center text-center">
          <OkapiMark className="size-11" />
          <h1 className="mt-3.5 text-2xl font-semibold tracking-tight">Okapi</h1>
          <p className="mt-1 text-sm text-muted">A calm place for your tasks.</p>
        </div>
        <div className={cx('surface-card animate-rise rounded-xl2 p-6 sm:p-7')}>{children}</div>
      </div>
    </div>
  );
}
