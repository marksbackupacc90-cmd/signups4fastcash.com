import React, { useEffect, useState } from 'react';

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
}

export const AuthModal: React.FC<AuthModalProps> = ({ user, onUserChange, openRequest = 0 }) => {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const needsUsername = Boolean(user && !user.username);

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json() as Promise<{ user: AuthUser | null }>)
      .then(({ user: currentUser }) => {
        onUserChange(currentUser);
        setOpen(!currentUser || !currentUser.username);
      })
      .catch(() => setOpen(true));
    const handleAuthComplete = () => {
      fetch('/api/auth/me')
        .then((response) => response.json() as Promise<{ user: AuthUser | null }>)
        .then(({ user: currentUser }) => {
          onUserChange(currentUser);
          setOpen(!currentUser || !currentUser.username);
        })
        .catch(() => setError('Could not load your account.'));
    };
    window.addEventListener('message', (event) => {
      if (event.origin === window.location.origin && event.data?.type === 'sfc-auth-complete') handleAuthComplete();
    });
  }, [onUserChange]);

  const signIn = () => {
    setError('');
    const popup = window.open('/api/auth/google', 'sfc-google-signin', 'width=520,height=650');
    if (!popup) setError('Please allow pop-ups to sign in with Google.');
  };

  const saveUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/auth/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="w-full max-w-md rounded-xl border border-cyan-400/30 bg-[#10141d] p-6 shadow-2xl">
        <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Your rewards account</p>
        <h2 id="account-title" className="mt-2 text-2xl font-bold text-white">
          {needsUsername ? 'Choose your username' : 'Create your account'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Sign in with Google to keep your survey rewards connected to your account.
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
            Continue with Google
          </button>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
        {!needsUsername && <p className="mt-4 text-center text-[11px] text-zinc-500">You can close this window after signing in; your username will be requested next.</p>}
      </section>
    </div>
  );
};
