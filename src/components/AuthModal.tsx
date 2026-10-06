import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, Users, X } from 'lucide-react';

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
  referralCode?: string | null;
  disabled?: boolean;
  requiredAuth?: boolean;
}

type ReferralPreviewState =
  | { status: 'loading' }
  | { status: 'verified'; referrerName: string }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export const AuthModal: React.FC<AuthModalProps> = ({ user, onUserChange, openRequest = 0, mode = 'signin', referralCode, disabled = false, requiredAuth = false }) => {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [referralPreview, setReferralPreview] = useState<ReferralPreviewState | null>(null);
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
    if (!referralCode) {
      setReferralPreview(null);
      return;
    }
    const controller = new AbortController();
    setReferralPreview({ status: 'loading' });
    fetch(`/api/referrals/preview?code=${encodeURIComponent(referralCode)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as { valid?: boolean; referrerName?: string };
        if (response.status === 404) {
          setReferralPreview({ status: 'invalid' });
          return;
        }
        if (!response.ok || data.valid !== true || typeof data.referrerName !== 'string') {
          setReferralPreview({ status: 'unavailable' });
          return;
        }
        setReferralPreview({ status: 'verified', referrerName: data.referrerName });
      })
      .catch((previewError: unknown) => {
        if (previewError instanceof DOMException && previewError.name === 'AbortError') return;
        setReferralPreview({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, [referralCode]);

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
    const code = referralCode || new URLSearchParams(window.location.search).get('ref')?.trim();
    const authUrl = code
      ? `/api/auth/google?ref=${encodeURIComponent(code)}`
      : '/api/auth/google';
    const popup = window.open(authUrl, 'sfc-google-signin', 'width=520,height=650');
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
          Optional: continue with Google to sync and track your offers across devices. You can browse and use offers without signing in.
        </p>
        {referralCode && referralPreview && (
          <div
            role={referralPreview.status === 'invalid' ? 'alert' : 'status'}
            className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${
              referralPreview.status === 'invalid'
                ? 'border-rose-300/20 bg-rose-400/5 text-rose-200'
                : 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100'
            }`}
          >
            {referralPreview.status === 'loading' ? (
              <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : referralPreview.status === 'verified' ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {referralPreview.status === 'loading' && 'Checking your referral link…'}
              {referralPreview.status === 'verified' && <>You were invited by <strong>{referralPreview.referrerName}</strong>. This referral code will be checked when you sign up; any reward is subject to eligibility and review.</>}
              {referralPreview.status === 'invalid' && 'This referral link could not be verified. You can still create an account, but this code will not be attached.'}
              {referralPreview.status === 'unavailable' && 'Your referral code is saved for signup, but we could not verify the inviter right now. Rewards are subject to eligibility and review.'}
            </span>
          </div>
        )}
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
        {!needsUsername && <p className="mt-4 text-center text-[11px] text-zinc-500">You will only be sent to Google after selecting “Continue with Google.”</p>}
      </section>
    </div>
  );
};
