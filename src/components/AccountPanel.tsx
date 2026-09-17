import React, { useState } from 'react';

interface AccountUser {
  id: string;
  email: string;
  username: string | null;
  avatarUrl?: string | null;
  paypalEmail?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  state?: string | null;
}

interface AccountPanelProps {
  user: AccountUser;
  onUserChange: (user: AccountUser) => void;
  onClose: () => void;
}

const PRESET_AVATARS = [
  { id: 'cyan', label: 'Cyan wave', background: '#0e7490', accent: '#67e8f9', mark: '✦' },
  { id: 'violet', label: 'Violet spark', background: '#5b21b6', accent: '#ddd6fe', mark: '✧' },
  { id: 'emerald', label: 'Emerald bolt', background: '#047857', accent: '#a7f3d0', mark: '⚡' },
  { id: 'amber', label: 'Amber sun', background: '#b45309', accent: '#fef3c7', mark: '✹' },
  { id: 'rose', label: 'Rose orbit', background: '#be123c', accent: '#ffe4e6', mark: '◉' },
];

function createPresetAvatar(background: string, accent: string, mark: string) {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  context.globalAlpha = 0.2;
  context.fillStyle = accent;
  context.beginPath();
  context.arc(42, 34, 50, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = accent;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(80, 80, 52, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = accent;
  context.font = 'bold 64px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(mark, 80, 82);
  return canvas.toDataURL('image/png');
}

export const AccountPanel: React.FC<AccountPanelProps> = ({ user, onUserChange, onClose }) => {
  const [form, setForm] = useState({
    username: user.username || '',
    avatarUrl: user.avatarUrl || '',
    paypalEmail: user.paypalEmail || '',
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    sex: user.sex || '',
    state: user.state || '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) return;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        update('avatarUrl', canvas.toDataURL('image/jpeg', 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

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
          </div>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-white">Close</button>
        </div>
        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold text-zinc-300">Profile picture
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} className="mt-1 w-full text-xs text-zinc-400" />
          </label>
          <div>
            <p className="text-xs font-semibold text-zinc-300">Or choose an avatar</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_AVATARS.map((preset) => {
                const selected = form.avatarUrl === createPresetAvatar(preset.background, preset.accent, preset.mark);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => update('avatarUrl', createPresetAvatar(preset.background, preset.accent, preset.mark))}
                    className={`focus-ring rounded-full p-0.5 transition-transform hover:scale-105 ${selected ? 'bg-cyan-300' : 'bg-transparent'}`}
                    aria-label={`Use ${preset.label} avatar`}
                    title={preset.label}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-xl" style={{ backgroundColor: preset.background, color: preset.accent }}>
                      {preset.mark}
                    </span>
                  </button>
                );
              })}
            </div>
            {form.avatarUrl && <img src={form.avatarUrl} alt="Selected profile avatar preview" className="mt-3 h-14 w-14 rounded-full object-cover ring-2 ring-cyan-300/50" />}
          </div>
          <label className="block text-xs font-semibold text-zinc-300">Username<input value={form.username} onChange={(e) => update('username', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" required /></label>
          <label className="block text-xs font-semibold text-zinc-300">PayPal email<input type="email" value={form.paypalEmail} onChange={(e) => update('paypalEmail', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" placeholder="For cash-out requests" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-zinc-300">Date of birth<input type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs font-semibold text-zinc-300">State<select value={form.state} onChange={(e) => update('state', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white"><option value="">Select state</option>{['AL','AK','AZ','AR','CA','CO','CT','FL','GA','IL','MA','MD','MI','MN','MO','NC','NJ','NM','NV','NY','OH','OK','OR','PA','SC','TN','TX','UT','VA','WA','WI'].map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
          </div>
          <label className="block text-xs font-semibold text-zinc-300">Sex<select value={form.sex} onChange={(e) => update('sex', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
          <p className="text-[11px] leading-relaxed text-zinc-500">These details are optional and used for account updates. Your password is managed by Google; change it in your Google Account.</p>
          <button disabled={saving} className="w-full rounded-lg border border-[#2dd4ee]/60 bg-[#2dd4ee] px-4 py-2.5 text-sm font-bold text-[#06131a] hover:bg-[#67e8f9] disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
          {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        </form>
      </section>
    </div>
  );
};
