import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, DollarSign, Mail, MousePointerClick, Send, ShieldCheck, Store } from 'lucide-react';
import { Offer, NewsletterSubscriber, EmailBlastLog, OfferRevenueEvent, SiteSettings } from '../types';
import type { OfferActivity, OfferActivitySinceReport } from '../types';
import { AdminOffersPage } from './AdminOffersPage';

type DashboardView = 'overview' | 'offers' | 'email';

interface AdminDashboardProps {
  initialView?: DashboardView;
  pendingOffers: Offer[];
  liveOffers: Offer[];
  subscribers: NewsletterSubscriber[];
  subscriberCount?: number;
  subscriberLoadError?: string | null;
  subscribersLoading?: boolean;
  onRefreshSubscribers?: () => void;
  onApproveOffer: (offerId: string, referralCode: string, referralUrl: string, blastEmail: boolean, updatedOffer?: Partial<Offer>) => void;
  onRejectOffer: (offerId: string) => void;
  onUpdateLiveOffer: (offerId: string, updates: Partial<Offer>) => void;
  onDeleteLiveOffer: (offerId: string) => void;
  onCreateCustomOffer: (newOffer: Omit<Offer, 'id' | 'clicksCount' | 'conversionsCount' | 'createdAt' | 'updatedAt'>) => void;
  blastLogs: EmailBlastLog[];
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (updates: Partial<SiteSettings>) => void;
  isOwnerAdmin?: boolean;
  adminUsernames?: string[];
  onUpdateAdminUsernames?: (usernames: string[]) => void;
}

const OFFER_ACTIVITY_CURSOR_KEY = 'signups4fastcash_offer_activity_last_checked';

function readOfferActivityCursor() {
  try {
    const saved = localStorage.getItem(OFFER_ACTIVITY_CURSOR_KEY);
    if (saved && Number.isFinite(Date.parse(saved)) && Date.parse(saved) <= Date.now()) return saved;
  } catch (error) {
    console.error('Could not read the last-checked offer activity time:', error);
  }
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialView = 'overview',
  ...props
}) => {
  const [view, setView] = useState<DashboardView>(initialView);
  const [growthChecklist, setGrowthChecklist] = useState<Record<string, string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('s4fc_growth_checklist') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  });
  const [selectedOfferId, setSelectedOfferId] = useState(props.liveOffers[0]?.id || '');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [activityReport, setActivityReport] = useState<OfferActivitySinceReport | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [revenueEvents, setRevenueEvents] = useState<OfferRevenueEvent[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueSaving, setRevenueSaving] = useState(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [revenueType, setRevenueType] = useState<'conversion' | 'commission'>('conversion');
  const [revenueOfferId, setRevenueOfferId] = useState(props.liveOffers[0]?.id || '');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueNote, setRevenueNote] = useState('');
  const [initialActivityCursor] = useState(readOfferActivityCursor);
  const activityCursorRef = useRef(initialActivityCursor);
  useEffect(() => {
    const controller = new AbortController();
    const loadActivityReport = async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const token = localStorage.getItem('signups4fastcash_admin_token') || '';
        const response = await fetch(`/api/admin/analytics/offers/since?from=${encodeURIComponent(activityCursorRef.current)}`, {
          headers: token ? { 'x-admin-token': token } : {},
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null) as (OfferActivitySinceReport & { error?: string }) | null;
        if (!response.ok || !data) throw new Error(data?.error || 'Could not load offer activity.');
        setActivityReport(data);
        try {
          localStorage.setItem(OFFER_ACTIVITY_CURSOR_KEY, data.to);
          activityCursorRef.current = data.to;
        } catch (error) {
          console.error('Could not save the last-checked offer activity time:', error);
          setActivityError('Clicks are shown, but this browser could not save the last-checked time. The same clicks may appear again next time.');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Could not load clicks since the last check:', error);
        setActivityError(error instanceof Error ? error.message : 'Could not load offer activity.');
        setActivityReport(null);
      } finally {
        if (!controller.signal.aborted) setActivityLoading(false);
      }
    };
    void loadActivityReport();
    return () => controller.abort();
  }, [activityRefreshKey]);
  useEffect(() => {
    if (!props.isOwnerAdmin) return;
    const controller = new AbortController();
    const loadRevenueEvents = async () => {
      setRevenueLoading(true);
      setRevenueError(null);
      try {
        const token = localStorage.getItem('signups4fastcash_admin_token') || '';
        const response = await fetch('/api/admin/revenue', {
          headers: token ? { 'x-admin-token': token } : {},
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null) as { events?: OfferRevenueEvent[]; error?: string } | null;
        if (!response.ok || !data) throw new Error(data?.error || 'Could not load the revenue ledger.');
        setRevenueEvents(data.events || []);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Could not load the owner revenue ledger:', error);
        setRevenueError(error instanceof Error ? error.message : 'Could not load the revenue ledger.');
      } finally {
        if (!controller.signal.aborted) setRevenueLoading(false);
      }
    };
    void loadRevenueEvents();
    return () => controller.abort();
  }, [props.isOwnerAdmin]);
  const activityByOffer = activityReport?.offers || {};
  const offersNeedingReview = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return props.liveOffers
      .filter((offer) => offer.verificationStatus !== 'reviewed'
        || !offer.verifiedAt
        || !Number.isFinite(Date.parse(offer.verifiedAt))
        || Date.parse(offer.verifiedAt) < cutoff
        || (offer.verificationExpiresAt && Date.parse(offer.verificationExpiresAt) < Date.now()))
      .sort((a, b) => {
        const aDate = a.verifiedAt ? Date.parse(a.verifiedAt) : 0;
        const bDate = b.verifiedAt ? Date.parse(b.verifiedAt) : 0;
        return aDate - bDate;
      });
  }, [props.liveOffers]);
  const markOfferChecked = (offer: Offer) => {
    const verifiedAt = new Date().toISOString();
    props.onUpdateLiveOffer(offer.id, {
      verifiedAt,
      verificationStatus: 'reviewed',
      verificationExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  };
  const growthTasks = [
    { id: 'offer', label: 'Add or improve one offer', detail: 'Verify the visitor reward, requirements, link, and payout terms.' },
    { id: 'guide', label: 'Publish one useful SEO guide', detail: 'Target one specific search and link it to a relevant offer.' },
    { id: 'promotion', label: 'Promote one page', detail: 'Turn a guide into a short video, post, or helpful community share.' },
  ];
  const plannerTasks = [
    { day: 'Monday', task: 'Check 5 offers', detail: 'Open each provider link and confirm the visitor reward, requirements, and URL.' },
    { day: 'Tuesday', task: 'Add or improve one offer', detail: 'Use a current referral link and write the offer from the visitor’s point of view.' },
    { day: 'Wednesday', task: 'Publish one SEO guide', detail: 'Answer one specific search and link it to the matching live offer.' },
    { day: 'Thursday', task: 'Create one promotion', detail: 'Turn the guide into a short video, social post, or helpful community answer.' },
    { day: 'Friday', task: 'Review the numbers', detail: 'Check Search Console impressions, offer clicks, and email subscribers.' },
  ];
  const currentWeek = (() => {
    const date = new Date();
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - day + 1);
    return start.toISOString().slice(0, 10);
  })();
  const markGrowthTaskComplete = (taskId: string) => {
    const next = { ...growthChecklist, [taskId]: currentWeek };
    setGrowthChecklist(next);
    localStorage.setItem('s4fc_growth_checklist', JSON.stringify(next));
  };

  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'offers' as const, label: 'Offers', icon: Store },
    { id: 'email' as const, label: 'Email', icon: Mail },
  ];
  const sendOfferEmail = async () => {
    if (!selectedOfferId) return;
    setEmailSending(true);
    setEmailStatus(null);
    const token = localStorage.getItem('signups4fastcash_admin_token') || '';
    const response = await fetch('/api/admin/newsletter/broadcast', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
      body: JSON.stringify({ offerId: selectedOfferId }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null) as { delivered?: number; error?: string } | null;
    setEmailStatus(response?.ok ? `Email sent to ${data?.delivered || 0} verified subscribers.` : (data?.error || 'Email could not be sent.'));
    setEmailSending(false);
  };
  const saveRevenueEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRevenueSaving(true);
    setRevenueError(null);
    try {
      const token = localStorage.getItem('signups4fastcash_admin_token') || '';
      const response = await fetch('/api/admin/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        body: JSON.stringify({
          offerId: revenueOfferId,
          type: revenueType,
          ...(revenueType === 'commission' ? { amount: Number(revenueAmount) } : {}),
          note: revenueNote,
        }),
      });
      const data = await response.json().catch(() => null) as { event?: OfferRevenueEvent; error?: string } | null;
      const savedEvent = data?.event;
      if (!response.ok || !savedEvent) throw new Error(data?.error || 'Could not save this revenue entry.');
      setRevenueEvents((current) => [savedEvent, ...current].slice(0, 200));
      setRevenueAmount('');
      setRevenueNote('');
    } catch (error) {
      console.error('Could not save an owner revenue entry:', error);
      setRevenueError(error instanceof Error ? error.message : 'Could not save this revenue entry.');
    } finally {
      setRevenueSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-cyan-300/15 bg-[linear-gradient(135deg,#101d2d,#0b121c)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-cyan-300">
              <ShieldCheck className="h-4 w-4" /> Owner control center
            </div>
            <h1 className="mt-2 text-2xl font-black text-white">Admin dashboard</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
              One place to monitor the site, manage the offer catalog, and send important email.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b1520] px-3 py-2 text-xs text-zinc-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Admin session active
          </div>
        </div>
        <nav className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4" aria-label="Admin sections">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${view === id ? 'bg-cyan-300 text-[#061016]' : 'border border-white/10 text-zinc-300 hover:bg-white/[0.06]'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'overview' && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Live offers', props.liveOffers.length, Store],
              ['New clicks since last check', activityReport?.totals.clicks.toLocaleString() ?? (activityLoading ? '…' : '—'), BarChart3],
              ['Conversion events since last check', activityReport?.totals.conversions.toLocaleString() ?? (activityLoading ? '…' : '—'), ShieldCheck],
              ['Subscribers', props.subscriberCount ?? props.subscribers.length, Mail],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4">
                <Icon className="h-4 w-4 text-cyan-300" />
                <div className="mt-3 text-2xl font-black text-white">{value}</div>
                <div className="mt-1 text-[11px] font-mono uppercase tracking-wider text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
          <section className="rounded-xl border border-cyan-300/15 bg-[#0e121a] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <MousePointerClick className="h-4 w-4 text-cyan-300" /> Recent offer activity
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  New clicks and recorded conversion events since the last successful check in this browser. Your first check includes the last 30 days.
                </p>
              </div>
              <div className="flex gap-1 rounded-lg border border-white/10 bg-[#090d12] p-1">
                <button
                  type="button"
                  onClick={() => setActivityRefreshKey((key) => key + 1)}
                  disabled={activityLoading}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {activityLoading ? 'Checking…' : 'Check new clicks'}
                </button>
              </div>
            </div>
            {activityLoading ? (
              <p className="mt-4 text-xs text-zinc-400" role="status">Loading clicks since the last check…</p>
            ) : activityError && !activityReport ? (
              <p className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200" role="alert">{activityError}</p>
            ) : (
              <>
                {activityError && <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100" role="alert">{activityError}</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.07] bg-[#090d12] p-4">
                    <div className="text-2xl font-black text-cyan-200">{activityReport?.totals.clicks.toLocaleString() || '0'}</div>
                    <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">New clicks since last check</div>
                  </div>
                  <div className="rounded-lg border border-white/[0.07] bg-[#090d12] p-4">
                    <div className="text-2xl font-black text-emerald-200">{activityReport?.totals.conversions.toLocaleString() || '0'}</div>
                    <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Recorded conversion events since last check</div>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-white/[0.07]">
                  {[...props.liveOffers]
                    .sort((left, right) => (activityByOffer[right.id]?.clicks || 0) - (activityByOffer[left.id]?.clicks || 0))
                    .filter((offer) => (activityByOffer[offer.id]?.clicks || 0) > 0 || (activityByOffer[offer.id]?.conversions || 0) > 0)
                    .map((offer) => {
                      const activity: OfferActivity = activityByOffer[offer.id] || { clicks: 0, conversions: 0 };
                      return (
                        <div key={offer.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-zinc-200">{offer.company}</div>
                            <div className="truncate text-[10px] text-zinc-500">{offer.title}</div>
                          </div>
                          <div className="shrink-0 text-right text-[11px] font-mono">
                            <span className="text-cyan-200">{activity.clicks} clicks</span>
                            <span className="mx-2 text-zinc-600">·</span>
                            <span className="text-emerald-200">{activity.conversions} conversion events</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {activityReport && Object.keys(activityReport.offers).length === 0 && (
                  <p className="mt-4 text-xs text-zinc-400">No referral clicks have been recorded since your last check.</p>
                )}
                {activityReport?.limitedByRetention && (
                  <p className="mt-3 text-xs text-amber-200">Click history is available for up to 365 days, so older activity is not included.</p>
                )}
                <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
                  Later checks begin at the last successful check in this browser. Conversion events are self-reported signals, not confirmation of a merchant signup or payout.
                </p>
                {activityReport && (
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Checked through {new Date(activityReport.to).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </section>
          {props.isOwnerAdmin && (
            <section className="rounded-xl border border-emerald-300/15 bg-[#0e121a] p-5" aria-labelledby="revenue-ledger-title">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <DollarSign className="h-4 w-4 text-emerald-300" />
                <h2 id="revenue-ledger-title">Confirmed conversions and commissions</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Owner-only records. Add a conversion only after you confirm it with the provider; record a commission only after you actually receive payment.
              </p>
              <form onSubmit={(event) => void saveRevenueEvent(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
                <label className="text-xs font-semibold text-zinc-300">
                  Offer
                  <select
                    value={revenueOfferId}
                    onChange={(event) => setRevenueOfferId(event.target.value)}
                    required
                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">Choose an offer</option>
                    {props.liveOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.company} — {offer.title}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-zinc-300">
                  Record
                  <select
                    value={revenueType}
                    onChange={(event) => setRevenueType(event.target.value as 'conversion' | 'commission')}
                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="conversion">Confirmed conversion</option>
                    <option value="commission">Commission received</option>
                  </select>
                </label>
                {revenueType === 'commission' && (
                  <label className="text-xs font-semibold text-zinc-300">
                    Amount received (USD)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={revenueAmount}
                      onChange={(event) => setRevenueAmount(event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 text-sm text-white"
                    />
                  </label>
                )}
                <button
                  type="submit"
                  disabled={revenueSaving || !revenueOfferId}
                  className="self-end rounded-lg bg-emerald-300 px-4 py-2.5 text-xs font-bold text-[#061016] hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {revenueSaving ? 'Saving…' : 'Add record'}
                </button>
                <label className="text-xs font-semibold text-zinc-300 sm:col-span-2 lg:col-span-4">
                  Note (optional)
                  <input
                    type="text"
                    maxLength={500}
                    value={revenueNote}
                    onChange={(event) => setRevenueNote(event.target.value)}
                    placeholder="For example, provider report or payment date"
                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500"
                  />
                </label>
              </form>
              {revenueError && <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200" role="alert">{revenueError}</p>}
              <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.08]">
                {revenueLoading ? (
                  <p className="p-4 text-xs text-zinc-400" role="status">Loading revenue records…</p>
                ) : revenueEvents.length === 0 ? (
                  <p className="p-4 text-xs text-zinc-400">No confirmed conversions or commissions recorded yet.</p>
                ) : (
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full min-w-[38rem] text-left text-xs">
                      <thead className="sticky top-0 bg-[#090d12] text-[10px] uppercase tracking-wider text-zinc-400">
                        <tr>
                          <th scope="col" className="px-3 py-2">Offer</th>
                          <th scope="col" className="px-3 py-2">Record</th>
                          <th scope="col" className="px-3 py-2">Amount</th>
                          <th scope="col" className="px-3 py-2">Date / note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {revenueEvents.map((entry) => (
                          <tr key={entry.id} className="text-zinc-200">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold">{entry.company}</div>
                              <div className="max-w-64 truncate text-[10px] text-zinc-500">{entry.title}</div>
                            </td>
                            <td className="px-3 py-2.5">{entry.type === 'conversion' ? 'Owner-confirmed conversion' : 'Commission received'}</td>
                            <td className="px-3 py-2.5">{entry.amount === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(entry.amount)}</td>
                            <td className="px-3 py-2.5">
                              <div>{new Date(entry.recordedAt).toLocaleString()}</div>
                              {entry.note && <div className="max-w-64 truncate text-[10px] text-zinc-500">{entry.note}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[10px] text-zinc-500">Showing up to 200 most recent records. These entries are separate from unverified visitor conversion reports.</p>
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <button type="button" onClick={() => setView('email')} className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-5 text-left transition-colors hover:bg-cyan-300/10">
              <Mail className="h-5 w-5 text-cyan-300" />
              <h2 className="mt-3 text-sm font-bold text-white">Send an email</h2>
              <p className="mt-1 text-xs text-zinc-400">Open the broadcast tools and subscriber controls.</p>
            </button>
          </div>
          <section className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  {offersNeedingReview.length ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  Offer verification queue
                </div>
                <p className="mt-1 text-xs text-zinc-400">Check the provider page for the link, reward, requirements, costs, and payout terms. Only mark an offer reviewed after checking those details.</p>
              </div>
              <button type="button" onClick={() => setView('offers')} className="text-xs font-bold text-cyan-300 hover:text-cyan-200">Open offer manager</button>
            </div>
            {offersNeedingReview.length === 0 ? (
              <p className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-300/5 p-3 text-xs text-emerald-200">All live offers have been checked within the last 30 days.</p>
            ) : (
              <div className="mt-4 divide-y divide-white/[0.07]">
                {offersNeedingReview.slice(0, 8).map((offer) => (
                  <div key={offer.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{offer.company}</div>
                      <div className="text-xs text-zinc-500">{offer.verifiedAt ? `Last reviewed ${new Date(offer.verifiedAt).toLocaleDateString()}` : 'Not independently reviewed'}</div>
                    </div>
                    <button type="button" onClick={() => markOfferChecked(offer)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/25 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-300/10">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark reviewed today
                    </button>
                  </div>
                ))}
                {offersNeedingReview.length > 8 && <p className="pt-3 text-xs text-zinc-500">Showing 8 of {offersNeedingReview.length} offers needing review.</p>}
              </div>
            )}
          </section>
          <section className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.03] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-white">Weekly growth checklist</div>
                <p className="mt-1 text-xs text-zinc-400">Small, repeatable actions that build traffic and trust over time.</p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">Resets weekly</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {growthTasks.map((task) => {
                const completedThisWeek = growthChecklist[task.id] === currentWeek;
                return (
                  <div key={task.id} className="rounded-lg border border-white/[0.08] bg-[#0e121a] p-4">
                    <div className={`text-sm font-bold ${completedThisWeek ? 'text-emerald-200' : 'text-white'}`}>{completedThisWeek ? 'Completed: ' : ''}{task.label}</div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">{task.detail}</p>
                    <button
                      type="button"
                      onClick={() => markGrowthTaskComplete(task.id)}
                      className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${completedThisWeek ? 'border border-emerald-300/20 text-emerald-200' : 'bg-cyan-300 text-[#061016] hover:bg-cyan-200'}`}
                    >
                      {completedThisWeek ? 'Done this week' : 'Mark complete'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 border-t border-white/[0.08] pt-5">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">Your weekly planner</div>
              <div className="mt-3 grid gap-2">
                {plannerTasks.map((item) => (
                  <div key={item.day} className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-[#0e121a] px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="w-20 shrink-0 text-xs font-bold text-cyan-300">{item.day}</div>
                    <div>
                      <div className="text-sm font-bold text-white">{item.task}</div>
                      <div className="mt-1 text-xs leading-relaxed text-zinc-500">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">This planner is intentionally small. Consistency matters more than adding dozens of offers or pages at once.</p>
            </div>
          </section>
        </section>
      )}

      {view === 'offers' && (
        <AdminOffersPage
          liveOffers={props.liveOffers}
          activityByOffer={activityByOffer}
          onRefreshActivity={() => setActivityRefreshKey((key) => key + 1)}
          onUpdateLiveOffer={props.onUpdateLiveOffer}
          onDeleteLiveOffer={props.onDeleteLiveOffer}
          onCreateCustomOffer={props.onCreateCustomOffer}
        />
      )}

      {view === 'email' && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#0e121a] p-5">
          <div className="flex items-center gap-2 text-cyan-300"><Mail className="h-5 w-5" /><h2 className="text-lg font-bold text-white">Email subscribers</h2></div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">Send a tested offer announcement to verified subscribers. Unverified and unsubscribed addresses are excluded automatically.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <select value={selectedOfferId} onChange={(event) => setSelectedOfferId(event.target.value)} className="rounded-lg border border-white/10 bg-[#090d12] px-3 py-3 text-sm text-white">
              <option value="">Choose an offer</option>
              {props.liveOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.company} — {offer.title}</option>)}
            </select>
            <button type="button" onClick={() => void sendOfferEmail()} disabled={!selectedOfferId || emailSending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#061016] disabled:cursor-not-allowed disabled:opacity-50">
              <Send className="h-4 w-4" /> {emailSending ? 'Sending...' : 'Send email'}
            </button>
          </div>
          {emailStatus && <div className={`mt-4 rounded-lg border p-3 text-xs ${emailStatus.startsWith('Email sent') ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-200' : 'border-rose-300/20 bg-rose-300/5 text-rose-200'}`}>{emailStatus}</div>}
          <div className="mt-5 rounded-lg border border-white/[0.08] bg-[#141824] p-4 text-xs text-zinc-400">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong className="text-white">{props.subscribers.length}</strong> confirmed active subscribers
                <p className="mt-1 text-[11px]">Only the owner can view subscriber email addresses. Delegated admins do not have access.</p>
              </div>
              {props.isOwnerAdmin && (
                <button
                  type="button"
                  onClick={props.onRefreshSubscribers}
                  disabled={props.subscribersLoading}
                  className="rounded-lg border border-white/15 px-3 py-2 font-semibold text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {props.subscribersLoading ? 'Loading…' : 'Refresh list'}
                </button>
              )}
            </div>
          </div>
          {props.isOwnerAdmin && (
            <section className="mt-4 overflow-hidden rounded-lg border border-white/[0.08]" aria-labelledby="subscriber-list-title">
              <div className="flex items-center justify-between gap-3 bg-[#090d12] px-4 py-3">
                <h3 id="subscriber-list-title" className="text-sm font-bold text-white">Confirmed email subscribers</h3>
                <span className="text-xs text-zinc-400">{props.subscribers.length} active</span>
              </div>
              {props.subscriberLoadError ? (
                <p className="p-4 text-sm text-rose-200" role="alert">{props.subscriberLoadError}</p>
              ) : props.subscribersLoading ? (
                <p className="p-4 text-sm text-zinc-300" role="status">Loading subscriber list…</p>
              ) : props.subscribers.length === 0 ? (
                <p className="p-4 text-sm text-zinc-400">No confirmed active subscribers yet.</p>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <thead className="sticky top-0 bg-[#141824] text-[10px] uppercase tracking-wider text-zinc-300">
                      <tr>
                        <th scope="col" className="px-4 py-2.5">Email</th>
                        <th scope="col" className="px-4 py-2.5">Frequency</th>
                        <th scope="col" className="px-4 py-2.5">Subscribed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {props.subscribers.map((subscriber) => (
                        <tr key={subscriber.id} className="text-zinc-200">
                          <td className="max-w-72 break-all px-4 py-3">{subscriber.email}</td>
                          <td className="px-4 py-3 capitalize">{subscriber.frequency}</td>
                          <td className="px-4 py-3 text-zinc-300">{new Date(subscriber.subscribedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </section>
      )}
    </div>
  );
};
