import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Mail, Settings, ShieldCheck, Store, Wrench } from 'lucide-react';
import { Offer, NewsletterSubscriber, EmailBlastLog, SiteSettings } from '../types';
import { AdminOffersPage } from './AdminOffersPage';
import { AdminPanel } from './AdminPanel';

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
  const [issueCount, setIssueCount] = useState<number | null>(null);
  const totalClicks = useMemo(() => props.liveOffers.reduce((total, offer) => total + Number(offer.clicksCount || 0), 0), [props.liveOffers]);
  const totalConversions = useMemo(() => props.liveOffers.reduce((total, offer) => total + Number(offer.conversionsCount || 0), 0), [props.liveOffers]);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/issue-alert', {
      headers: { 'x-admin-token': localStorage.getItem('signups4fastcash_admin_token') || '' },
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { openCount?: number };
      if (!cancelled) setIssueCount(Number(data.openCount || 0));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [view]);

  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'offers' as const, label: 'Offers', icon: Store, badge: issueCount || undefined },
    { id: 'email' as const, label: 'Email', icon: Mail },
  ];

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
              One place to monitor the site, fix reported offers, manage the offer catalog, and send important email.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Admin session active
          </div>
        </div>
        <nav className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4" aria-label="Admin sections">
          {nav.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${view === id ? 'bg-cyan-300 text-[#061016]' : 'border border-white/10 text-zinc-300 hover:bg-white/[0.06]'}`}
            >
              <Icon className="h-4 w-4" /> {label}
              {badge ? <span className="rounded-full bg-rose-400 px-1.5 py-0.5 text-[10px] text-[#160609]">{badge}</span> : null}
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
            <button type="button" onClick={() => setView('offers')} className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-5 text-left transition-colors hover:bg-amber-300/10">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h2 className="mt-3 text-sm font-bold text-white">Review offer issues</h2>
              <p className="mt-1 text-xs text-zinc-400">{issueCount === null ? 'Checking reports...' : `${issueCount} open issue${issueCount === 1 ? '' : 's'} currently need review.`}</p>
            </button>
            <button type="button" onClick={() => setView('email')} className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-5 text-left transition-colors hover:bg-cyan-300/10">
              <Mail className="h-5 w-5 text-cyan-300" />
              <h2 className="mt-3 text-sm font-bold text-white">Send an email</h2>
              <p className="mt-1 text-xs text-zinc-400">Open the broadcast tools and subscriber controls.</p>
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4 text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-bold text-zinc-200"><Wrench className="h-4 w-4 text-zinc-400" /> Admin rules</div>
            <p className="mt-2 leading-relaxed">Resolve an issue only after checking the provider link and terms. Use the Offers tab to see the exact report attached to the affected offer.</p>
          </div>
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
        <AdminPanel
          initialTab="blasts"
          pendingOffers={props.pendingOffers}
          liveOffers={props.liveOffers}
          subscribers={props.subscribers}
          onApproveOffer={props.onApproveOffer}
          onRejectOffer={props.onRejectOffer}
          onUpdateLiveOffer={props.onUpdateLiveOffer}
          onDeleteLiveOffer={props.onDeleteLiveOffer}
          onCreateCustomOffer={props.onCreateCustomOffer}
          blastLogs={props.blastLogs}
          siteSettings={props.siteSettings}
          onUpdateSiteSettings={props.onUpdateSiteSettings}
          isOwnerAdmin={props.isOwnerAdmin}
          adminUsernames={props.adminUsernames}
          onUpdateAdminUsernames={props.onUpdateAdminUsernames}
        />
      )}
    </div>
  );
};
