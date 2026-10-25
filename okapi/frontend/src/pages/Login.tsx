import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { AuthLayout } from '@/components/Layout';
import { Banner, Button, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { account, initialising, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const justRegistered = (location.state as { registered?: string } | null)?.registered;
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (!initialising && account) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed. Check your username and password.'));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-0.5 text-sm text-muted">Sign in to pick up where you left off.</p>
        </div>

        {justRegistered && <Banner tone="success">{justRegistered}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        <Input
          label="Username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={event => setUsername(event.target.value)}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
        />

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={event => setRememberMe(event.target.checked)}
            className="size-4 cursor-pointer rounded border-[var(--border-strong)] accent-brand-600 dark:accent-brand-500"
          />
          Keep me signed in
        </label>

        <Button type="submit" loading={submitting} className="w-full">
          Sign in
        </Button>

        <p className="pt-1 text-center text-sm text-muted">
          No account yet?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
