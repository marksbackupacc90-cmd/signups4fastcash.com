import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { createDeviceFingerprint } from '../utils/deviceFingerprint';

interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  paypalEmail?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  state?: string | null;
}

interface AuthModalProps {
  user: AuthUser | null;
  onUserChange: (user: AuthUser | null) => void;
  openRequest?: number;
  mode?: 'signin' | 'signup';
  disabled?: boolean;
  requiredAuth?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ user, onUserChange, openRequest = 0, mode = 'signin', disabled = false, requiredAuth = false }) => {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [formMode, setFormMode] = useState(mode);
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const needsUsername = Boolean(user && !user.username);
  const [authPopup, setAuthPopup] = useState<Window | null>(null);

  const loadAuthenticatedUser = async () => {
    const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
    if (!response.ok) throw new Error('Could not load your account.');
    const data = await response.json() as { user: AuthUser | null };
    onUserChange(data.user);
    if (data.user) {
      setOpen(!data.user.username);
      setAuthPopup(null);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!disabled && !user && (openRequest > 0 || requiredAuth)) setOpen(true);
  }, [disabled, openRequest, requiredAuth, user]);

  useEffect(() => {
    setFormMode(mode);
    setError('');
    setFieldErrors({});
  }, [mode]);

  useEffect(() => {
    const referralCode = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase();
    if (referralCode && /^[A-Z0-9](?:[A-Z0-9_-]{1,22}[A-Z0-9])$/.test(referralCode)) {
      document.cookie = `sfc_referral=${encodeURIComponent(referralCode)}; path=/; max-age=86400; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    }
  }, []);

  useEffect(() => {
    if (disabled) return;
    loadAuthenticatedUser()
      .catch(() => {
        onUserChange(null);
      });
    const handleAuthComplete = () => {
      loadAuthenticatedUser()
        .catch(() => setError('Could not load your account.'));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source === authPopup && event.data?.type === 'sfc-auth-complete') handleAuthComplete();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authPopup, disabled, onUserChange]);

  const signIn = async () => {
    setError('');
    setFieldErrors({});
    try {
      const device = await createDeviceFingerprint();
      document.cookie = `sfc_device_fingerprint=${encodeURIComponent(device.hash)}; path=/; max-age=2592000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch {
      // Continue with Google sign-in if fingerprint capture is unavailable.
    }
    const popup = window.open('/api/auth/google', 'sfc-google-signin', 'width=520,height=650');
    if (!popup) setError('Please allow pop-ups to sign in with Google.');
    else {
      setAuthPopup(popup);
      let closedChecks = 0;
      const poll = window.setInterval(async () => {
        try {
          const authenticated = await loadAuthenticatedUser();
          if (authenticated) {
            window.clearInterval(poll);
            setAuthPopup(null);
          } else if (popup.closed && closedChecks >= 8) {
            window.clearInterval(poll);
            setAuthPopup(null);
            setError('Google sign-in did not create a session. Please try again.');
          } else if (popup.closed) {
            closedChecks += 1;
          }
        } catch {
          if (popup.closed && closedChecks >= 8) {
            window.clearInterval(poll);
            setAuthPopup(null);
            setError('Could not load your account.');
          } else if (popup.closed) {
            closedChecks += 1;
          }
        }
      }, 700);
      window.setTimeout(() => {
        if (!popup.closed && !user) return;
        window.clearInterval(poll);
      }, 10 * 60 * 1000);
    }
  };

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const nextFieldErrors: Record<string, string> = {};
    if (formMode === 'signup') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.trim().length > 254) {
        nextFieldErrors.email = 'Enter a valid email address.';
      }
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) {
        nextFieldErrors.username = 'Use 3-24 letters, numbers, or underscores.';
      }
      const passwordLength = Array.from(password).length;
      const passwordBytes = new TextEncoder().encode(password).length;
      if (passwordLength < 12 || passwordBytes > 72) {
        nextFieldErrors.password = 'Use at least 12 characters and no more than 72 UTF-8 bytes.';
      }
    } else {
      const loginIdentifier = identifier.trim();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(loginIdentifier);
      const validUsername = /^[a-zA-Z0-9_]{3,24}$/.test(loginIdentifier);
      if (!validEmail && !validUsername) {
        nextFieldErrors.identifier = 'Enter a valid email address or username.';
      }
      if (!password || new TextEncoder().encode(password).length > 72) {
        nextFieldErrors.password = 'Enter a valid password.';
      }
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) return;

    setSubmitting(true);
    try {
      const device = await createDeviceFingerprint();
      const response = await fetch(formMode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formMode === 'signup'
          ? {
              email: email.trim(),
              username: username.trim(),
              password,
              deviceFingerprint: device.hash,
              ref: new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase()
                || document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('sfc_referral='))?.slice('sfc_referral='.length),
            }
          : { identifier: identifier.trim(), password, deviceFingerprint: device.hash }),
      });
      const data = await response.json() as { user?: AuthUser; error?: string; field?: string };
      if (!response.ok || !data.user) {
        if (data.field) setFieldErrors({ [data.field]: data.error || 'Check this field and try again.' });
        else setError(data.error || 'Could not sign in. Please try again.');
        return;
      }
      onUserChange(data.user);
      setOpen(false);
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const saveUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) {
      setFieldErrors({ username: 'Username must be 3-24 letters, numbers, or underscores.' });
      return;
    }
    try {
      const response = await fetch('/api/auth/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });
      const data = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !data.user) {
        setError(data.error || 'Could not save your username.');
        return;
      }
      onUserChange(data.user);
      setOpen(false);
    } catch {
      setError('Could not reach the account service. Check your connection and try again.');
    }
  };

  if (disabled || !open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-brand-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-mono uppercase tracking-wider text-brand-accent">Your rewards account</p>
          {!requiredAuth && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cancel sign in"
              className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <h2 id="account-title" className="mt-2 text-2xl font-bold text-white">
          {needsUsername ? 'Choose your username' : formMode === 'signup' ? 'Create your account' : 'Sign in to your account'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {needsUsername
            ? 'Choose a username to finish setting up your account.'
            : formMode === 'signup'
              ? 'Create a free account to save your progress and sync offers across devices.'
              : 'Sign in to continue to your rewards account.'}
        </p>
        <div role="note" className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
          <p className="text-xs leading-5 text-amber-50/90">
            <strong className="font-bold text-amber-100">Fair-use and anti-fraud notice:</strong> VPN, proxy, and duplicate-account use to bypass offer eligibility or tracking rules is prohibited. Device and network security signals are logged; suspected abuse may trigger account restrictions or manual review. Read our <a className="font-semibold underline underline-offset-2 hover:text-white" href="/terms">Terms of Service</a>.
          </p>
        </div>
        {needsUsername ? (
          <form onSubmit={saveUsername} className="mt-5 space-y-3">
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="account-username">Username</label>
            <input
              id="account-username"
              value={username}
              onChange={(event) => { setUsername(event.target.value); clearFieldError('username'); }}
              placeholder="cashfinder"
              autoComplete="username"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'account-username-error' : 'account-username-help'}
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
            />
            {fieldErrors.username
              ? <p id="account-username-error" role="alert" className="text-xs text-rose-300">{fieldErrors.username}</p>
              : <p id="account-username-help" className="text-xs text-zinc-500">3-24 letters, numbers, or underscores.</p>}
            <button type="submit" className="w-full rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-bold text-brand-bg hover:brightness-110">
              Continue
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={signIn}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-xs font-black">G</span>
              Continue with Google
            </button>
            <p className="my-4 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Or continue with email</p>
            <form onSubmit={submitCredentials} className="space-y-3" noValidate>
              {formMode === 'signup' ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-300" htmlFor="account-email">Email</label>
                    <input
                      id="account-email"
                      type="email"
                      value={email}
                      onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }}
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'account-email-error' : undefined}
                      className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                    />
                    {fieldErrors.email && <p id="account-email-error" role="alert" className="mt-1 text-xs text-rose-300">{fieldErrors.email}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-300" htmlFor="account-signup-username">Username</label>
                    <input
                      id="account-signup-username"
                      value={username}
                      onChange={(event) => { setUsername(event.target.value); clearFieldError('username'); }}
                      autoComplete="username"
                      aria-invalid={Boolean(fieldErrors.username)}
                      aria-describedby={fieldErrors.username ? 'account-signup-username-error' : undefined}
                      className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                    />
                    {fieldErrors.username && <p id="account-signup-username-error" role="alert" className="mt-1 text-xs text-rose-300">{fieldErrors.username}</p>}
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-300" htmlFor="account-identifier">Email or username</label>
                  <input
                    id="account-identifier"
                    value={identifier}
                    onChange={(event) => { setIdentifier(event.target.value); clearFieldError('identifier'); }}
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.identifier)}
                    aria-describedby={fieldErrors.identifier ? 'account-identifier-error' : undefined}
                    className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                  />
                  {fieldErrors.identifier && <p id="account-identifier-error" role="alert" className="mt-1 text-xs text-rose-300">{fieldErrors.identifier}</p>}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-300" htmlFor="account-password">Password</label>
                <input
                  id="account-password"
                  type="password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }}
                  autoComplete={formMode === 'signup' ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'account-password-error' : formMode === 'signup' ? 'account-password-help' : undefined}
                  className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                />
                {fieldErrors.password
                  ? <p id="account-password-error" role="alert" className="mt-1 text-xs text-rose-300">{fieldErrors.password}</p>
                  : formMode === 'signup' && <p id="account-password-help" className="mt-1 text-xs text-zinc-500">At least 12 characters; maximum 72 UTF-8 bytes.</p>}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-bold text-brand-bg hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? 'Please wait…' : formMode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-zinc-400">
              {formMode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setFormMode(formMode === 'signup' ? 'signin' : 'signup');
                  setError('');
                  setFieldErrors({});
                  setPassword('');
                }}
                className="font-semibold text-brand-accent underline-offset-4 hover:underline"
              >
                {formMode === 'signup' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
        {!needsUsername && <p className="mt-3 text-center text-[11px] text-zinc-500">Google sign-in opens only after you select “Continue with Google.”</p>}
      </section>
    </div>
  );
};
