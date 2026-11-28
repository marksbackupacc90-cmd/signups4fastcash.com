import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface ProviderCredential {
  providerSlug: string;
  providerName: string;
  credentialSlug: string;
  credentialName: string;
  updatedAt: string;
}

export const AdminIntegrations: React.FC = () => {
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [providerName, setProviderName] = useState('');
  const [credentialName, setCredentialName] = useState('API key');
  const [credentialValue, setCredentialValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('signups4fastcash_admin_token') || '';
      const response = await fetch('/api/admin/provider-credentials', {
        headers: token ? { 'x-admin-token': token } : {},
      });
      const data = await response.json().catch(() => null) as {
        credentials?: ProviderCredential[];
        error?: string;
      } | null;
      if (!response.ok || !Array.isArray(data?.credentials)) {
        throw new Error(data?.error || 'Could not load provider credentials.');
      }
      setCredentials(data.credentials);
    } catch (loadError) {
      console.error('Could not load provider credentials:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load provider credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const saveCredential = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const token = localStorage.getItem('signups4fastcash_admin_token') || '';
      const response = await fetch('/api/admin/provider-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        body: JSON.stringify({ providerName, credentialName, value: credentialValue }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || 'Could not save this credential.');
      setCredentialValue('');
      setStatus('Credential saved encrypted. Its secret value will not be shown again.');
      await loadCredentials();
    } catch (saveError) {
      console.error('Could not save provider credential:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this credential.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCredential = async (credential: ProviderCredential) => {
    if (!window.confirm(`Delete ${credential.credentialName} for ${credential.providerName}?`)) return;
    setError(null);
    setStatus(null);
    try {
      const token = localStorage.getItem('signups4fastcash_admin_token') || '';
      const response = await fetch(
        `/api/admin/provider-credentials/${encodeURIComponent(credential.providerSlug)}/${encodeURIComponent(credential.credentialSlug)}`,
        { method: 'DELETE', headers: token ? { 'x-admin-token': token } : {} },
      );
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || 'Could not delete this credential.');
      setStatus('Credential deleted.');
      await loadCredentials();
    } catch (deleteError) {
      console.error('Could not delete provider credential:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this credential.');
    }
  };

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-cyan-300/15 bg-[#0e121a] p-5">
        <div className="flex items-center gap-2 text-cyan-300">
          <KeyRound className="h-5 w-5" />
          <h2 className="text-lg font-bold text-white">Provider credentials</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
          Store provider API keys and other secrets here for a future integration. Values are encrypted on the server and never sent back to this page.
        </p>
        <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 text-xs leading-relaxed text-amber-100">
          Saving a key does not connect an unknown provider automatically. The provider’s API still needs a compatible integration in the site before the key can be used. Do not enter a key until you know which integration it belongs to.
        </p>
      </header>

      <form onSubmit={saveCredential} className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#0e121a] p-5">
        <h3 className="text-sm font-bold text-white">Add or replace a credential</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-zinc-300">
            Provider or integration
            <input
              required
              maxLength={80}
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
              placeholder="Example: Provider name"
              autoComplete="organization"
              className="w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-zinc-300">
            Credential label
            <input
              required
              maxLength={40}
              value={credentialName}
              onChange={(event) => setCredentialName(event.target.value)}
              placeholder="API key, App ID, Secret"
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 text-sm text-white"
            />
          </label>
        </div>
        <label className="space-y-1.5 text-xs font-semibold text-zinc-300">
          Secret value
          <input
            required
            maxLength={4096}
            type="password"
            value={credentialValue}
            onChange={(event) => setCredentialValue(event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 font-mono text-sm text-white"
          />
        </label>
        <div>
          <button
            type="submit"
            disabled={saving || !credentialValue.trim()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-[#061016] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {saving ? 'Saving securely…' : 'Save credential'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-sm text-rose-200">{error}</p>}
      {status && <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-200">{status}</p>}

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e121a]" aria-labelledby="saved-provider-credentials">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <h3 id="saved-provider-credentials" className="text-sm font-bold text-white">Saved credentials</h3>
          <button type="button" onClick={() => void loadCredentials()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        {loading ? (
          <p role="status" className="p-5 text-sm text-zinc-400">Loading saved credentials…</p>
        ) : credentials.length === 0 ? (
          <p className="p-5 text-sm text-zinc-400">No provider credentials saved.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {credentials.map((credential) => (
              <li key={`${credential.providerSlug}:${credential.credentialSlug}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-white">{credential.providerName} <span className="text-zinc-400">/ {credential.credentialName}</span></p>
                  <p className="mt-1 text-xs text-zinc-500">Saved {new Date(credential.updatedAt).toLocaleString()} · secret hidden</p>
                </div>
                <button type="button" onClick={() => void deleteCredential(credential)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-300/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};
