import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, LifeBuoy, LoaderCircle, MessageSquareText, RefreshCw, Send, ShieldCheck } from 'lucide-react';

type TicketStatus = 'OPEN' | 'PENDING_NETWORK_REVIEW' | 'RESOLVED';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'Missing Points from Offer', label: 'Missing Points from Offer' },
  { value: 'Withdrawal Issue', label: 'Withdrawal Issue' },
  { value: 'Account Access', label: 'Account Access' },
  { value: 'Offer Terms or Eligibility', label: 'Offer Terms or Eligibility' },
  { value: 'Other', label: 'Other' },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTicket(value: unknown): SupportTicket | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.subject !== 'string'
    || typeof value.message !== 'string'
    || (value.status !== 'OPEN' && value.status !== 'PENDING_NETWORK_REVIEW' && value.status !== 'RESOLVED')
    || typeof value.createdAt !== 'string') return null;
  return {
    id: value.id,
    subject: value.subject,
    message: value.message,
    status: value.status,
    createdAt: value.createdAt,
  };
}

function getErrorMessage(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === 'string' ? payload.error : fallback;
}

interface SupportDeskProps {
  signedIn?: boolean;
  onSignIn?: () => void;
  embedded?: boolean;
}

export const SupportDesk: React.FC<SupportDeskProps> = ({ signedIn, onSignIn, embedded = false }) => {
  const [isSignedIn, setIsSignedIn] = useState(signedIn === true);
  const [authLoading, setAuthLoading] = useState(signedIn === undefined);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>(CATEGORIES[0].value);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (signedIn !== undefined) {
      setIsSignedIn(signedIn);
      setAuthLoading(false);
      return;
    }

    let active = true;
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !isRecord(payload) || !('user' in payload)) {
          throw new Error(getErrorMessage(payload, 'Could not verify your account.'));
        }
        if (active) setIsSignedIn(payload.user !== null);
      } catch (sessionError) {
        if (active) {
          setIsSignedIn(false);
          setError(sessionError instanceof Error ? sessionError.message : 'Could not verify your account.');
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void checkSession();
    return () => { active = false; };
  }, [signedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }

    let active = true;
    const loadTickets = async () => {
      setLoadingTickets(true);
      setError('');
      try {
        const response = await fetch('/api/v1/support/tickets', { cache: 'no-store', credentials: 'include' });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(getErrorMessage(payload, 'Could not load your support tickets.'));
        if (!isRecord(payload) || !Array.isArray(payload.tickets)) throw new Error('The support ticket list returned an invalid response.');
        const nextTickets: SupportTicket[] = [];
        for (const ticketData of payload.tickets) {
          const ticket = parseTicket(ticketData);
          if (!ticket) throw new Error('A support ticket had invalid data.');
          nextTickets.push(ticket);
        }
        if (active) setTickets(nextTickets);
      } catch (loadError) {
        if (active) {
          if (loadError instanceof Error && loadError.message.includes('Sign in')) setIsSignedIn(false);
          setError(loadError instanceof Error ? loadError.message : 'Could not load your support tickets.');
        }
      } finally {
        if (active) setLoadingTickets(false);
      }
    };
    void loadTickets();
    return () => { active = false; };
  }, [isSignedIn, refreshKey]);

  const submitTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn || submitting) return;
    const details = message.trim();
    if (details.length < 10) {
      setError('Please include at least 10 characters describing the issue.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: category,
          message: details,
          transactionReferenceId: reference.trim(),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(payload, 'Could not submit your support ticket.'));
      if (!isRecord(payload)) throw new Error('The submitted ticket response was invalid.');
      const ticket = parseTicket(payload.ticket);
      if (!ticket) throw new Error('The submitted ticket response was invalid.');
      setTickets((current) => [ticket, ...current.filter((item) => item.id !== ticket.id)].slice(0, 100));
      setNotice(`Ticket submitted: ${ticket.id.slice(0, 8)}.`);
      setMessage('');
      setReference('');
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message.includes('Sign in')) setIsSignedIn(false);
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const openSignIn = () => {
    if (onSignIn) onSignIn();
    else window.location.assign('/?auth=signin');
  };

  const openTickets = tickets.filter((ticket) => ticket.status !== 'RESOLVED');
  const resolvedTickets = tickets.filter((ticket) => ticket.status === 'RESOLVED');
  const ContentContainer = embedded ? 'section' : 'main';

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-brand-bg text-brand-text`}>
      {!embedded && (
        <header className="border-b border-white/10 bg-slate-950/70">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <a href="/" className="flex items-center gap-2 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
              <LifeBuoy className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              Signups4FastCash Support
            </a>
            <a href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to offers
            </a>
          </div>
        </header>
      )}

      <ContentContainer className={`mx-auto max-w-6xl space-y-6 px-4 sm:px-6 ${embedded ? 'py-1' : 'py-8 sm:py-10'}`}>
        <section>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200"><MessageSquareText className="h-4 w-4" aria-hidden="true" /> Help &amp; Support Desk</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">How can we help?</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Send a support request and follow its status here. For offer rewards, include the offer or transaction reference when available.</p>
        </section>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">{notice}</p>}

        {authLoading ? (
          <div className="ui-card flex items-center gap-3 text-sm text-slate-300"><LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" aria-hidden="true" />Checking account access…</div>
        ) : !isSignedIn ? (
          <section className="ui-card flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-white">Sign in to contact support</h2>
              <p className="mt-1 text-sm text-slate-400">Your tickets and updates are private to your account.</p>
            </div>
            <button type="button" onClick={openSignIn} className="ui-button ui-button-primary">Sign in</button>
          </section>
        ) : (
          <>
            <form onSubmit={(event) => void submitTicket(event)} className="ui-card grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-labelledby="new-ticket-title">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Private account support</p>
                <h2 id="new-ticket-title" className="mt-2 text-xl font-bold text-white">Open a ticket</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Please do not include passwords, full payment-card numbers, or government ID in your message.</p>
              </div>
              <div className="space-y-4">
                <label className="form-field">
                  <span className="form-label">Issue category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number]['value'])}>
                    {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">Offer or transaction reference <span className="font-normal text-slate-500">(optional)</span></span>
                  <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={255} placeholder="Offer name or reference ID" />
                </label>
                <label className="form-field">
                  <span className="form-label">Describe the issue</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={5000} rows={5} placeholder="Tell us what happened and when..." />
                  <span className="field-hint">10–5,000 characters · {message.length}/5,000</span>
                </label>
                <button type="submit" disabled={submitting} className="ui-button ui-button-primary w-full sm:w-auto">
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {submitting ? 'Submitting…' : 'Submit support ticket'}
                </button>
              </div>
            </form>

            <section aria-labelledby="open-tickets-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Your account</p>
                  <h2 id="open-tickets-title" className="mt-1 text-xl font-bold text-white">Open Tickets</h2>
                </div>
                <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loadingTickets} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white disabled:opacity-60">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingTickets ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
                </button>
              </div>
              {loadingTickets && tickets.length === 0 ? (
                <p className="flex items-center gap-2 py-6 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />Loading tickets…</p>
              ) : openTickets.length === 0 ? (
                <p className="ui-card text-sm text-slate-400">No open tickets. New requests and status updates will appear here.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {openTickets.map((ticket) => (
                    <li key={ticket.id} className="ui-card !p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">{ticket.subject}</p>
                          <p className="mt-1 text-[11px] text-slate-500">Ticket {ticket.id.slice(0, 8)} · {new Date(ticket.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${ticket.status === 'OPEN' ? 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100' : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100'}`}>
                          {ticket.status === 'OPEN' ? 'Open' : 'Network review'}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-300">{ticket.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              {resolvedTickets.length > 0 && (
                <details className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/30 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-300">Resolved tickets ({resolvedTickets.length})</summary>
                  <ul className="mt-3 grid gap-3 md:grid-cols-2">
                    {resolvedTickets.map((ticket) => (
                      <li key={ticket.id} className="rounded-xl border border-slate-700/60 p-4">
                        <p className="text-sm font-semibold text-slate-200">{ticket.subject}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Ticket {ticket.id.slice(0, 8)} · Resolved</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          </>
        )}
      </ContentContainer>
    </div>
  );
};
