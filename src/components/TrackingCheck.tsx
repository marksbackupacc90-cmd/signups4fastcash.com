import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CircleHelp, LoaderCircle, LockKeyhole, RotateCw, ShieldCheck, X } from 'lucide-react';

type CheckStatus = 'passed' | 'attention' | 'not-tested';

interface CheckResult {
  id: string;
  title: string;
  detail: string;
  status: CheckStatus;
}

const probeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function checkFirstPartyCookies(): CheckResult {
  const name = `sfc_tracking_check_${probeId().replace(/-/g, '')}`;
  let canReadCookie = false;
  try {
    document.cookie = `${name}=1; Path=/; Max-Age=60; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    canReadCookie = document.cookie.split(';').some((cookie) => cookie.trim() === `${name}=1`);
  } catch {
    canReadCookie = false;
  }

  let cleanupSucceeded = true;
  try {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    cleanupSucceeded = !document.cookie.split(';').some((cookie) => cookie.trim().startsWith(`${name}=`));
  } catch {
    cleanupSucceeded = false;
  }

  if (!cleanupSucceeded) {
    return {
      id: 'cookies',
      title: 'First-party cookies',
      status: 'attention',
      detail: 'The temporary test cookie could not be confirmed as removed. Review this site’s cookie settings or clear its site data.',
    };
  }

  return canReadCookie
    ? { id: 'cookies', title: 'First-party cookies', status: 'passed', detail: 'This site can set and read a temporary first-party cookie. The test cookie was removed.' }
    : { id: 'cookies', title: 'First-party cookies', status: 'attention', detail: 'This browser did not allow the temporary first-party cookie. If you choose, allow cookies for this site only and run the check again.' };
}

function checkStorage(id: string, title: string, getStorage: () => Storage): CheckResult {
  const key = `sfc_tracking_check_${probeId()}`;
  let storageWorks = false;
  let storageError = false;
  let storage: Storage | null = null;
  try {
    storage = getStorage();
    storage.setItem(key, 'ok');
    storageWorks = storage.getItem(key) === 'ok';
  } catch {
    storageError = true;
  }

  let cleanupSucceeded = true;
  if (storage) {
    try {
      storage.removeItem(key);
      cleanupSucceeded = storage.getItem(key) === null;
    } catch {
      cleanupSucceeded = false;
    }
  }

  if (!cleanupSucceeded) {
    return {
      id,
      title,
      status: 'attention',
      detail: 'The temporary test value could not be confirmed as removed. Review or clear this site’s stored data.',
    };
  }

  return storageWorks && !storageError
    ? { id, title, status: 'passed', detail: 'Temporary site data could be written, read, and removed.' }
    : { id, title, status: 'attention', detail: 'This browser blocked temporary site storage. If you choose, allow site data for this site only and run the check again.' };
}

async function checkIndexedDb(): Promise<CheckResult> {
  const id = 'indexeddb';
  const title = 'IndexedDB site storage';
  if (!('indexedDB' in window)) {
    return { id, title, status: 'attention', detail: 'IndexedDB is unavailable in this browser context. Check the browser’s site-data settings or try a standard browsing window.' };
  }

  const databaseName = `sfc-tracking-check-${probeId()}`;
  let database: IDBDatabase | null = null;
  let storageWorks = false;
  let cleanupSucceeded = false;

  try {
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('probe');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('IndexedDB could not be opened.'));
    });

    const openedDatabase = database;
    storageWorks = await new Promise<boolean>((resolve, reject) => {
      const transaction = openedDatabase.transaction('probe', 'readwrite');
      const store = transaction.objectStore('probe');
      store.put('ok', 'temporary');
      let valueMatches = false;
      const request = store.get('temporary');
      request.onsuccess = () => { valueMatches = request.result === 'ok'; };
      request.onerror = () => reject(new Error('IndexedDB could not read its temporary test value.'));
      transaction.oncomplete = () => resolve(valueMatches);
      transaction.onerror = () => reject(new Error('IndexedDB could not complete its temporary test.'));
      transaction.onabort = () => reject(new Error('IndexedDB test was interrupted.'));
    });
  } catch {
    storageWorks = false;
  } finally {
    database?.close();
    try {
      cleanupSucceeded = await new Promise<boolean>((resolve) => {
        const request = window.indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
        request.onblocked = () => resolve(false);
      });
    } catch {
      cleanupSucceeded = false;
    }
  }

  if (!cleanupSucceeded) {
    return { id, title, status: 'attention', detail: 'The temporary test database could not be confirmed as removed. Review or clear this site’s stored data.' };
  }

  return storageWorks
    ? { id, title, status: 'passed', detail: 'Temporary browser storage worked and the test database was removed.' }
    : { id, title, status: 'attention', detail: 'This browser blocked temporary site storage. If you choose, allow site data for this site only and run the check again.' };
}

function checkReferralParameters(): CheckResult {
  const sampleUrl = new URL('/go/offer-earnx?ref=8HLWMZ&utm_source=tracking-check', window.location.origin);
  const query = new URLSearchParams(sampleUrl.search);
  const preserved = sampleUrl.pathname === '/go/offer-earnx'
    && query.get('ref') === '8HLWMZ'
    && query.get('utm_source') === 'tracking-check';

  return preserved
    ? { id: 'parameters', title: 'Referral URL parameters', status: 'passed', detail: 'This browser can parse and preserve sample referral parameters locally. No offer link was opened.' }
    : { id: 'parameters', title: 'Referral URL parameters', status: 'attention', detail: 'The sample referral parameters were not preserved. Check whether a browser extension is rewriting links.' };
}

const checks: { id: string; run: () => CheckResult | Promise<CheckResult> }[] = [
  { id: 'cookies', run: checkFirstPartyCookies },
  { id: 'local-storage', run: () => checkStorage('local-storage', 'Local storage', () => window.localStorage) },
  { id: 'session-storage', run: () => checkStorage('session-storage', 'Session storage', () => window.sessionStorage) },
  { id: 'indexeddb', run: checkIndexedDb },
  { id: 'parameters', run: checkReferralParameters },
];

const notTested: CheckResult[] = [
  { id: 'merchant-tracking', title: 'Merchant attribution and offer pixels', status: 'not-tested', detail: 'This check does not open affiliate links or contact advertisers. Only the provider can confirm attribution for a specific offer.' },
  { id: 'third-party-cookies', title: 'Third-party cookies and tracker blockers', status: 'not-tested', detail: 'No third-party trackers or pixels are loaded, and privacy extensions are not probed.' },
  { id: 'privacy-fingerprinting', title: 'Private browsing, VPN, and privacy signals', status: 'not-tested', detail: 'These can reveal sensitive browsing details, so this checker does not try to identify them.' },
];

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'passed') return <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />;
  if (status === 'attention') return <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" />;
  return <CircleHelp className="h-4 w-4 text-zinc-400" aria-hidden="true" />;
}

interface TrackingCheckProps {
  onClose: () => void;
}

export const TrackingCheck: React.FC<TrackingCheckProps> = ({ onClose }) => {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const mountedRef = useRef(true);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const runButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    mountedRef.current = true;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [closeButtonRef.current, runButtonRef.current].filter((element): element is HTMLButtonElement => element !== null && !element.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, []);

  const runChecks = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResults([]);
    setCompletedCount(0);
    const completed: CheckResult[] = [];

    for (const check of checks) {
      let result: CheckResult;
      try {
        result = await check.run();
      } catch {
        result = {
          id: check.id,
          title: 'Browser check',
          status: 'attention',
          detail: 'The browser could not complete this check. Review this site’s browser permissions and try again.',
        };
      }
      completed.push(result);
      if (!mountedRef.current) return;
      setResults([...completed]);
      setCompletedCount(completed.length);
    }

    setIsRunning(false);
  };

  const passedCount = results?.filter((result) => result.status === 'passed').length ?? 0;
  const attentionCount = results?.filter((result) => result.status === 'attention').length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 px-3 py-6 backdrop-blur-sm sm:px-5 sm:py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isRunning) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-check-title"
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0c1017] shadow-2xl"
      >
        <div className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_0%_0%,rgba(45,212,238,0.12),transparent_35%),#10141d] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-200">Browser diagnostics</p>
                <h2 id="tracking-check-title" className="mt-1 text-2xl font-bold text-white sm:text-3xl">Referral Tracking Check</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">
                  Check basic browser storage and referral-link handling before starting an offer. A clean result cannot confirm that a provider credited an offer.
                </p>
              </div>
            </div>
            <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close tracking check">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-zinc-300">
            <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>Runs only in this browser. Temporary test data is removed; nothing is sent to S4FC or advertisers.</span>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {isRunning ? `Checking browser storage · ${completedCount} of ${checks.length}` : results ? `${passedCount} passed · ${attentionCount} need attention · ${notTested.length} not tested` : 'Run a quick browser check'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">A few quick checks. No offer links are opened and no third-party tracking pixels are loaded.</p>
            </div>
            <button
              ref={runButtonRef}
              type="button"
              onClick={() => void runChecks()}
              disabled={isRunning}
              className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-[#06131a] transition-colors hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : results ? <RotateCw className="h-4 w-4" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {isRunning ? 'Checking…' : results ? 'Run again' : 'Run browser check'}
            </button>
          </div>

          {results && (
            <div aria-live="polite" className="space-y-5">
              <section aria-labelledby="tracking-core-title">
                <h3 id="tracking-core-title" className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Local browser checks</h3>
                <div className="space-y-2">
                  {checks.map((check) => {
                    const result = results.find((item) => item.id === check.id);
                    return (
                      <div key={check.id} className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#141824] p-3">
                        <span className="mt-0.5"><StatusIcon status={result?.status ?? 'not-tested'} /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{check.id === 'local-storage' ? 'Local storage' : check.id === 'session-storage' ? 'Session storage' : check.id === 'indexeddb' ? 'IndexedDB site storage' : check.id === 'parameters' ? 'Referral URL parameters' : 'First-party cookies'}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{result?.detail ?? (isRunning ? 'Waiting for this check.' : 'Not run yet.')}</p>
                        </div>
                        {result && <span className={`ml-auto shrink-0 self-start rounded px-2 py-1 text-[10px] font-bold uppercase ${result.status === 'passed' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{result.status === 'passed' ? 'Passed' : 'Review'}</span>}
                      </div>
                    );
                  })}
                </div>
              </section>

              {!isRunning && attentionCount > 0 && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <h3 className="text-sm font-semibold text-amber-100">Things to try</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-zinc-300">
                    <li>Review browser site-data settings for signups4fastcash.com; if you choose to allow storage, make it a site-specific exception.</li>
                    <li>Try a standard browser window if you are currently in a restricted or temporary browsing session.</li>
                    <li>Keep privacy protections enabled globally. This check cannot diagnose a merchant’s individual tracking setup.</li>
                  </ul>
                </div>
              )}

              <section aria-labelledby="tracking-limits-title">
                <h3 id="tracking-limits-title" className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Not checked by this tool</h3>
                <div className="space-y-2">
                  {notTested.map((result) => (
                    <div key={result.id} className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#10141d] p-3">
                      <span className="mt-0.5"><StatusIcon status={result.status} /></span>
                      <div>
                        <p className="text-sm font-semibold text-white">{result.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{result.detail}</p>
                      </div>
                      <span className="ml-auto shrink-0 self-start rounded bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">Not tested</span>
                    </div>
                  ))}
                </div>
              </section>

              <p className="text-xs leading-relaxed text-zinc-400">
                If a provider offers its own tracking checker, run that checker for the specific offer. A browser check or referral click is not proof of signup, completion, credit, or payout. Don’t turn off privacy protections globally just to qualify.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
