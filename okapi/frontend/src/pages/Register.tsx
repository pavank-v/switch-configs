import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { AuthLayout } from '@/components/Layout';
import { Banner, Button, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Mirrors the backend's ManagedUserVM constraints so we fail fast before the round trip. */
const LOGIN_PATTERN = /^[a-zA-Z0-9!$&*+=?^_`{|}~.-]+@?[a-zA-Z0-9!$&*+=?^_`{|}~.-]*$/;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 100;

interface Fields {
  login: string;
  email: string;
  password: string;
  confirm: string;
}

export default function RegisterPage() {
  const { account, initialising, register } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Fields>({ login: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!initialising && account) {
    return <Navigate to="/" replace />;
  }

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields(current => ({ ...current, [key]: event.target.value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };

  function validate(): boolean {
    const next: Partial<Record<keyof Fields, string>> = {};

    const login = fields.login.trim();
    if (login.length < 1) {
      next.login = 'Pick a username.';
    } else if (login.length > 50) {
      next.login = 'Keep this under 50 characters.';
    } else if (!LOGIN_PATTERN.test(login)) {
      next.login = 'Letters, digits and . - _ only.';
    }

    const email = fields.email.trim();
    if (!email) {
      next.email = 'We need an email address.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      next.email = 'That does not look like an email address.';
    }

    if (fields.password.length < PASSWORD_MIN) {
      next.password = `At least ${PASSWORD_MIN} characters.`;
    } else if (fields.password.length > PASSWORD_MAX) {
      next.password = `At most ${PASSWORD_MAX} characters.`;
    }

    if (fields.confirm !== fields.password) {
      next.confirm = 'The two passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await register({
        login: fields.login.trim().toLowerCase(),
        email: fields.email.trim(),
        password: fields.password,
      });
      navigate('/login', {
        replace: true,
        state: { registered: 'Account created. Sign in to get started.' },
      });
    } catch (err) {
      setFormError(errorMessage(err, 'Could not create the account.'));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Create your account</h2>
          <p className="mt-0.5 text-sm text-muted">It takes about ten seconds.</p>
        </div>

        {formError && <Banner tone="error">{formError}</Banner>}

        <Input
          label="Username"
          name="login"
          autoComplete="username"
          autoFocus
          required
          value={fields.login}
          onChange={set('login')}
          error={errors.login}
        />

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={fields.email}
          onChange={set('email')}
          error={errors.email}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={fields.password}
          onChange={set('password')}
          error={errors.password}
          hint={`${PASSWORD_MIN}+ characters`}
        />

        <Input
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={fields.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />

        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>

        <p className="pt-1 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
