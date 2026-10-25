import { useState, type FormEvent } from 'react';

import { Banner, Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, type Account } from '@/lib/auth';
import { useToast } from '@/lib/toast';

export default function SettingsPage() {
  const { account, refresh } = useAuth();
  const { notify } = useToast();

  if (!account) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted">Signed in as {account.login}.</p>
      </header>

      <ProfileCard account={account} onSaved={refresh} notify={notify} />
      <PasswordCard notify={notify} />
    </div>
  );
}

interface CardProps {
  notify: (message: string, tone?: 'success' | 'error') => void;
}

function ProfileCard({ account, onSaved, notify }: CardProps & { account: Account; onSaved: () => Promise<void> }) {
  const [firstName, setFirstName] = useState(account.firstName ?? '');
  const [lastName, setLastName] = useState(account.lastName ?? '');
  const [email, setEmail] = useState(account.email);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // The backend expects the whole AdminUserDTO back, not a patch.
      await api.post('/api/account', {
        ...account,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        email: email.trim(),
      });
      await onSaved();
      notify('Profile saved.');
    } catch (err) {
      setError(errorMessage(err, 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card rounded-xl2 p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight">Profile</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {error && <Banner tone="error">{error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={event => setFirstName(event.target.value)}
          />
          <Input
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={event => setLastName(event.target.value)}
          />
        </div>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordCard({ notify }: CardProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 4) {
      setError('The new password needs at least 4 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/account/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      notify('Password changed.');
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card rounded-xl2 p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight">Password</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {error && <Banner tone="error">{error}</Banner>}
        <Input
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
          />
          <Input
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}
