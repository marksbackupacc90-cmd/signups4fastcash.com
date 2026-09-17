import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

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
  const [error, setError] = useState('');
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
    if (!disabled && (openRequest > 0 || (requiredAuth && !user))) setOpen(true);
  }, [disabled, openRequest, requiredAuth, user]);

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

  const signIn = () => {
    setError('');
    const popup = window.open('/api/auth/google', 'sfc-google-signin', 'width=520,height=650');
    if (!popup) setError('Please allow pop-ups to sign in with Google.');
    else {
      setAuthPopup(popup);
      const poll = window.setInterval(async () => {
        try {
          const authenticated = await loadAuthenticatedUser();
          if (authenticated || popup.closed) {
            window.clearInterval(poll);
            setAuthPopup(null);
          }
        } catch {
          if (popup.closed) {
            window.clearInterval(poll);
            setAuthPopup(null);
            setError('Could not load your account.');
          }
        }
      }, 700);
      window.setTimeout(() => {
        if (!popup.closed && !user) return;
        window.clearInterval(poll);
      }, 10 * 60 * 1000);
    }
  };

  const saveUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
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
  };

  if (disabled || !open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="w-full max-w-md rounded-xl border border-cyan-400/30 bg-[#10141d] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Your rewards account</p>
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
          {needsUsername ? 'Choose your username' : mode === 'signup' ? 'Create your account' : 'Sign in to your account'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {mode === 'signup'
            ? 'Create an account with Google to save your preferences and receive offer updates.'
            : 'Sign in with Google to manage your account and receive offer updates.'}
        </p>
        {needsUsername ? (
          <form onSubmit={saveUsername} className="mt-5 space-y-3">
            <label className="block text-xs font-semibold text-zinc-300" htmlFor="account-username">Username</label>
            <input
              id="account-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="cashfinder"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
            />
            <p className="text-xs text-zinc-500">3-24 letters, numbers, or underscores.</p>
            <button type="submit" className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-black hover:bg-cyan-200">
              Continue
            </button>
          </form>
        ) : (
          <button onClick={signIn} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-zinc-200">
            {mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
          </button>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
        {!needsUsername && <p className="mt-4 text-center text-[11px] text-zinc-500">You can close this window after signing in; your username will be requested next.</p>}
      </section>
    </div>
  );
};
