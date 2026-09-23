import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Mail, Send, ShieldCheck, Store } from 'lucide-react';
import { Offer, NewsletterSubscriber, EmailBlastLog, SiteSettings } from '../types';
import { AdminOffersPage } from './AdminOffersPage';

type DashboardView = 'overview' | 'offers' | 'email';

interface AdminDashboardProps {
  initialView?: DashboardView;
  pendingOffers: Offer[];
  liveOffers: Offer[];
  subscribers: NewsletterSubscriber[];
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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialView = 'overview',
  ...props
}) => {
  const [view, setView] = useState<DashboardView>(initialView);
  const [selectedOfferId, setSelectedOfferId] = useState(props.liveOffers[0]?.id || '');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const totalClicks = useMemo(() => props.liveOffers.reduce((total, offer) => total + Number(offer.clicksCount || 0), 0), [props.liveOffers]);
  const totalConversions = useMemo(() => props.liveOffers.reduce((total, offer) => total + Number(offer.conversionsCount || 0), 0), [props.liveOffers]);
  const offersNeedingReview = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return props.liveOffers
      .filter((offer) => !offer.verifiedAt || !Number.isFinite(Date.parse(offer.verifiedAt)) || Date.parse(offer.verifiedAt) < cutoff)
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
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200">
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
              ['Offer clicks', totalClicks, BarChart3],
              ['Conversions', totalConversions, ShieldCheck],
              ['Subscribers', props.subscribers.length, Mail],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4">
                <Icon className="h-4 w-4 text-cyan-300" />
                <div className="mt-3 text-2xl font-black text-white">{value}</div>
                <div className="mt-1 text-[11px] font-mono uppercase tracking-wider text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
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
                <p className="mt-1 text-xs text-zinc-400">Check referral links, reward terms, and requirements at least once every 30 days.</p>
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
                      <div className="text-xs text-zinc-500">{offer.verifiedAt ? `Last checked ${new Date(offer.verifiedAt).toLocaleDateString()}` : 'Never checked'}</div>
                    </div>
                    <button type="button" onClick={() => markOfferChecked(offer)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/25 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-300/10">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark checked today
                    </button>
                  </div>
                ))}
                {offersNeedingReview.length > 8 && <p className="pt-3 text-xs text-zinc-500">Showing 8 of {offersNeedingReview.length} offers needing review.</p>}
              </div>
            )}
          </section>
        </section>
      )}

      {view === 'offers' && (
        <AdminOffersPage
          liveOffers={props.liveOffers}
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
            <strong className="text-white">{props.subscribers.length}</strong> subscriber records are loaded in this session.
          </div>
        </section>
      )}
    </div>
  );
};
