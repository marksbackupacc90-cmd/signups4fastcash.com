import React, { useState } from 'react';

interface AccountUser {
  id: string;
  email: string;
  username: string | null;
  paypalEmail?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  state?: string | null;
}

interface AccountPanelProps {
  user: AccountUser;
  onUserChange: (user: AccountUser) => void;
  onClose: () => void;
  balancePoints: number;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({ user, onUserChange, onClose, balancePoints }) => {
  const [form, setForm] = useState({
    username: user.username || '',
    paypalEmail: user.paypalEmail || '',
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    sex: user.sex || '',
    state: user.state || '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { user?: AccountUser; error?: string };
      if (!response.ok || !data.user) {
        setError(data.error || 'Could not save your profile.');
        return;
      }
      onUserChange(data.user);
      setMessage('Profile saved.');
    } catch {
      setError('Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="profile-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-cyan-400/30 bg-[#10141d] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Account settings</p>
            <h2 id="profile-title" className="mt-2 text-2xl font-bold text-white">Your profile</h2>
            <p className="mt-1 text-xs text-zinc-500">{user.email}</p>
            <p className="mt-3 text-sm font-semibold text-emerald-300">Survey balance: ${(balancePoints / 100).toFixed(2)} ({balancePoints.toLocaleString()} points)</p>
          </div>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-white">Close</button>
        </div>
        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold text-zinc-300">Username<input value={form.username} onChange={(e) => update('username', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" required /></label>
          <label className="block text-xs font-semibold text-zinc-300">PayPal email<input type="email" value={form.paypalEmail} onChange={(e) => update('paypalEmail', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" placeholder="For cash-out requests" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-zinc-300">Date of birth<input type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs font-semibold text-zinc-300">State<select value={form.state} onChange={(e) => update('state', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white"><option value="">Select state</option>{['AL','AK','AZ','AR','CA','CO','CT','FL','GA','IL','MA','MD','MI','MN','MO','NC','NJ','NM','NV','NY','OH','OK','OR','PA','SC','TN','TX','UT','VA','WA','WI'].map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
          </div>
          <label className="block text-xs font-semibold text-zinc-300">Sex<select value={form.sex} onChange={(e) => update('sex', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
          <p className="text-[11px] leading-relaxed text-zinc-500">These details are optional and used for payout processing and survey eligibility. Your password is managed by Google; change it in your Google Account.</p>
          <button disabled={saving} className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-black hover:bg-cyan-200 disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
          {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        </form>
      </section>
    </div>
  );
};
