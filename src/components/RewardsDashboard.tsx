import React, { useEffect, useRef, useState } from 'react';
import { LivePayoutTicker } from './LivePayoutTicker';
import { PvPLobbyArena } from './PvPLobbyArena';
import { SupportDesk } from './SupportDesk';
import { CommunityChat } from './CommunityChat';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  ChevronDown,
  CircleHelp,
  Gift,
  Home,
  Landmark,
  Menu,
  Pause,
  Play,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Swords,
  UserRound,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

type Milestone = { level: number; reward: string; complete?: boolean };
type TaskOffer = {
  id: string;
  title: string;
  partner: string;
  category: string;
  description: string;
  reward: string;
  progress: number;
  progressLabel: string;
  milestones: Milestone[];
  accent: 'teal' | 'violet' | 'amber';
};

const taskOffers: TaskOffer[] = [
  {
    id: 'earnx-levels',
    title: 'Level-up challenge',
    partner: 'EarnX · Example offer',
    category: 'Mobile game',
    description: 'Reach new levels in the game to unlock each reward stage. Progress is verified by the game provider.',
    reward: '$34.50',
    progress: 40,
    progressLabel: 'Level 8 of 20',
    milestones: [
      { level: 5, reward: '$2.00', complete: true },
      { level: 10, reward: '$7.50' },
      { level: 20, reward: '$25.00' },
    ],
    accent: 'teal',
  },
  {
    id: 'daily-streak',
    title: 'Build a 7-day streak',
    partner: 'Daily Quest · Example offer',
    category: 'Daily activity',
    description: 'Check in each day this week. Your streak progress is kept together in one clear task card.',
    reward: '$4.00',
    progress: 57,
    progressLabel: '4 of 7 days',
    milestones: [
      { level: 3, reward: '$1.00', complete: true },
      { level: 7, reward: '$3.00' },
    ],
    accent: 'violet',
  },
  {
    id: 'welcome-bonus',
    title: 'Complete your first session',
    partner: 'Starter bonus · Example offer',
    category: 'Getting started',
    description: 'Finish the introductory session and confirm your account to unlock the welcome reward.',
    reward: '$2.50',
    progress: 0,
    progressLabel: 'Not started',
    milestones: [
      { level: 1, reward: '$2.50' },
    ],
    accent: 'amber',
  },
];

const cashouts = [
  { handle: 'm•••a7', initials: 'M', amount: '$42.80', method: 'PayPal', time: '2 min ago', tone: 'teal' },
  { handle: 'j•••k2', initials: 'J', amount: '$18.25', method: 'USDC', time: '7 min ago', tone: 'violet' },
  { handle: 'r•••n9', initials: 'R', amount: '$75.00', method: 'Bank transfer', time: '12 min ago', tone: 'amber' },
  { handle: 's•••e4', initials: 'S', amount: '$9.50', method: 'PayPal', time: '19 min ago', tone: 'rose' },
  { handle: 'a•••v1', initials: 'A', amount: '$26.40', method: 'USDC', time: '24 min ago', tone: 'blue' },
];

type LiveCashout = typeof cashouts[number];

function MethodIcon({ method }: { method: string }) {
  if (method === 'USDC') return <CircleDollarSign className="h-4 w-4" aria-hidden="true" />;
  if (method === 'Bank transfer') return <Landmark className="h-4 w-4" aria-hidden="true" />;
  return <Banknote className="h-4 w-4" aria-hidden="true" />;
}

const MilestoneOfferCard: React.FC<{ offer: TaskOffer }> = ({ offer }) => {
  const accentClasses = {
    teal: {
      icon: 'border-teal-300/20 bg-teal-300/10 text-teal-200',
      bar: 'bg-teal-300',
      pill: 'border-teal-300/20 bg-teal-300/[0.08] text-teal-100',
    },
    violet: {
      icon: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
      bar: 'bg-violet-300',
      pill: 'border-violet-300/20 bg-violet-300/[0.08] text-violet-100',
    },
    amber: {
      icon: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
      bar: 'bg-amber-300',
      pill: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    },
  }[offer.accent];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700/80 bg-brand-card shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${accentClasses.icon}`}>
              {offer.accent === 'teal' ? <Zap className="h-5 w-5" aria-hidden="true" /> : offer.accent === 'violet' ? <Sparkles className="h-5 w-5" aria-hidden="true" /> : <Gift className="h-5 w-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">{offer.partner}</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">{offer.title}</h3>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accentClasses.pill}`}>{offer.category}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Up to</p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-white">{offer.reward}</p>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{offer.description}</p>

        <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white">Milestone tracker</h4>
            <span className="text-xs font-medium tabular-nums text-slate-300">{offer.progressLabel}</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-label={`${offer.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={offer.progress}
          >
            <div className={`h-full rounded-full ${accentClasses.bar}`} style={{ width: `${offer.progress}%` }} />
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {offer.milestones.map((milestone, index) => (
              <li key={`${milestone.level}-${milestone.reward}`} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-700/60 bg-slate-900/65 px-3 py-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${milestone.complete ? 'bg-teal-300/15 text-teal-200' : 'bg-slate-800 text-slate-300'}`}>
                  {milestone.complete ? <Check className="h-4 w-4" aria-label="Completed" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-200">Level {milestone.level}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">Reward {milestone.reward}</span>
                </span>
                {milestone.complete && <span className="text-[10px] font-semibold text-teal-200">Done</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-teal-300" aria-hidden="true" />
            Rewards depend on verified completion and offer terms.
          </p>
          <a
            href="#milestones"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-white transition hover:border-teal-300/50 hover:bg-teal-300/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200"
          >
            View stages <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
};

export const RewardsDashboard: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'recommended' | 'all'>('recommended');
  const [tickerPaused, setTickerPaused] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [liveCashouts, setLiveCashouts] = useState<LiveCashout[]>(cashouts);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [dashboardView, setDashboardView] = useState<'earn' | 'arena' | 'support'>('earn');
  const withdrawDialogRef = useRef<HTMLElement | null>(null);
  const visibleOffers = activeFilter === 'recommended' ? taskOffers.slice(0, 2) : taskOffers;

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(viewport.matches);
    updateViewport();
    viewport.addEventListener('change', updateViewport);
    return () => viewport.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Rewards Dashboard Preview | Signups4FastCash.com';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/activity`);
    socket.addEventListener('message', (message) => {
      try {
        const payload = JSON.parse(message.data) as {
          event?: string;
          data?: { handle?: string; amountText?: string; method?: string; tag?: string };
        };
        if (payload.event !== 'cashout.activity' || !payload.data) return;
        const event = payload.data;
        const handle = event.handle || 'u***';
        setLiveCashouts((current) => [{
          handle,
          initials: handle.replace(/[^a-z]/gi, '').slice(0, 1).toUpperCase() || 'C',
          amount: event.amountText || '$0.00',
          method: event.method || 'Offer reward',
          time: 'Just now',
          tone: event.tag === 'Cash-out' ? 'violet' : 'teal',
        }, ...current].slice(0, 12));
      } catch {
        // Ignore malformed public activity frames.
      }
    });
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (!withdrawDialogOpen) return;
    const previouslyFocused = document.activeElement;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWithdrawDialogOpen(false);
      if (event.key === 'Tab') {
        event.preventDefault();
        withdrawDialogRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    };
    withdrawDialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [withdrawDialogOpen]);

  const sidebarNavigation = (
    <nav aria-label="Workspace navigation" className="space-y-1 p-3">
      <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
      <button type="button" onClick={() => { setDashboardView('earn'); setMobileNavOpen(false); }} aria-current={dashboardView === 'earn' ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${dashboardView === 'earn' ? 'border-brand-accent/20 bg-brand-accent/[0.09] font-semibold text-brand-accent shadow-[inset_0_0_18px_rgba(34,211,238,0.04)]' : 'border-transparent font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}>
        <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
        Earn Dashboard
      </button>
      <button type="button" onClick={() => { setDashboardView('earn'); setMobileNavOpen(false); window.dispatchEvent(new CustomEvent('s4fc-open-rps')); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-violet-300/[0.08] hover:text-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
        <Swords className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
        PvP Arena
      </button>
      <button type="button" onClick={() => {
        setDashboardView('earn');
        setMobileNavOpen(false);
        window.setTimeout(() => document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
        <ReceiptText className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
        Live Ledger
      </button>
      <button type="button" onClick={() => { setMobileNavOpen(false); setWithdrawDialogOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
        <WalletCards className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
        Cashout
      </button>
      <button type="button" onClick={() => { setDashboardView('support'); setMobileNavOpen(false); }} aria-current={dashboardView === 'support' ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${dashboardView === 'support' ? 'border-cyan-300/20 bg-cyan-300/[0.08] font-semibold text-cyan-100' : 'border-transparent font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}>
        <CircleHelp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        Help &amp; Support Desk
      </button>
      <div className="mx-3 my-3 border-t border-slate-700/70" />
      <p className="px-3 text-[11px] leading-5 text-slate-500">Your progress and balance appear here when connected to your account.</p>
    </nav>
  );

  return (
    <div className="rewards-dashboard font-dashboard min-h-screen bg-brand-bg text-brand-text">
      <LivePayoutTicker />
      <header className="sticky top-0 z-50 border-b border-slate-700/70 bg-[#0b1220]/95 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1600px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-200 transition hover:border-brand-accent/40 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent md:hidden"
              aria-label={mobileNavOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
              aria-expanded={mobileNavOpen}
              aria-controls="workspace-sidebar"
            >
              {mobileNavOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
            <a href="/" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-200" aria-label="Signups4FastCash home">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent">
                <Coins className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 max-[380px]:hidden">
                <span className="block truncate text-sm font-extrabold tracking-tight text-white sm:text-base">Rewards Hub</span>
                <span className="hidden text-[11px] text-slate-400 sm:block">Your earning dashboard</span>
              </span>
            </a>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 max-[380px]:gap-1 sm:gap-2.5">
            <div aria-label="Available cash: $124.80 USD" className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 max-[380px]:px-1.5 sm:px-3">
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:block">Available cash</span>
              <span className="block text-xs font-extrabold tabular-nums text-white sm:mt-0.5 sm:text-sm">$124.80 <span className="text-[9px] font-semibold text-teal-200 max-[380px]:hidden">USD</span></span>
            </div>
            <div aria-label="3,240 points" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/[0.12] px-2.5 text-xs font-extrabold tabular-nums text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.12)] max-[380px]:gap-0 max-[380px]:px-1.5 sm:gap-2 sm:px-3">
              <Zap className="h-3.5 w-3.5 text-fuchsia-200 max-[380px]:hidden" aria-hidden="true" />
              <span>3,240 <span className="text-[9px] font-bold uppercase tracking-wide text-fuchsia-200 max-[380px]:hidden">pts</span></span>
            </div>
            <details className="relative">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-200 transition hover:border-brand-accent/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent [&::-webkit-details-marker]:hidden max-[380px]:h-9 max-[380px]:w-9" aria-label="Notifications (2 unread)">
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-400 px-1 text-[9px] font-black text-slate-950" aria-hidden="true">2</span>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                <p className="text-sm font-bold text-white">Notifications</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">Your example milestone and account activity updates will appear here.</p>
                <span className="mt-3 inline-flex rounded-full bg-fuchsia-300/10 px-2.5 py-1 text-[10px] font-semibold text-fuchsia-200">2 unread · Preview</span>
              </div>
            </details>
            <details className="relative">
              <summary aria-label="Open profile menu" className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-2 text-slate-200 transition hover:border-brand-accent/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent [&::-webkit-details-marker]:hidden max-[380px]:h-9 max-[380px]:w-9 max-[380px]:justify-center max-[380px]:gap-0 max-[380px]:p-0 sm:gap-2 sm:px-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-brand-accent"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
                <span className="hidden text-xs font-semibold sm:inline">Demo member</span>
                <ChevronDown className="h-3.5 w-3.5 max-[380px]:hidden" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Preview account</p>
                <a href="/" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"><UserRound className="h-4 w-4 text-slate-400" aria-hidden="true" /> Profile settings</a>
                <button type="button" onClick={() => setWithdrawDialogOpen(true)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium text-slate-200 hover:bg-white/[0.06]"><WalletCards className="h-4 w-4 text-slate-400" aria-hidden="true" /> Cashout options</button>
              </div>
            </details>
            <button
              type="button"
              onClick={() => setWithdrawDialogOpen(true)}
              className="hidden min-h-10 items-center gap-1.5 rounded-xl bg-brand-accent px-3 py-2 text-xs font-extrabold text-[#07131a] shadow-[0_5px_18px_rgba(94,234,212,0.14)] transition hover:bg-brand-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent sm:inline-flex sm:px-4 sm:text-sm"
            >
              <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-black/55 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close workspace navigation"
        />
      )}
      <div className="mx-auto flex max-w-[1600px] items-start md:gap-0">
        <aside
          id="workspace-sidebar"
          aria-label="Workspace sidebar"
          inert={isMobileViewport && !mobileNavOpen}
          className={`fixed bottom-0 left-0 top-[76px] z-40 w-[min(18rem,86vw)] overflow-y-auto border-r border-slate-700/70 bg-[#101722] shadow-2xl transition-transform duration-200 motion-reduce:transition-none md:sticky md:top-[76px] md:z-20 md:h-[calc(100vh-76px)] md:w-60 md:shrink-0 md:translate-x-0 md:shadow-none ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          <div className="border-b border-slate-700/70 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Main menu</p>
          </div>
          {sidebarNavigation}
        </aside>

        <main id="overview" className="min-w-0 flex-1 px-4 pb-12 pt-7 sm:px-6 sm:pt-9 lg:px-8">
        {dashboardView === 'earn' ? (
        <>
        <section className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-200">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Your reward center
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Make progress. Earn rewards.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Pick up where you left off or discover a new task. Example data is shown for this dashboard template.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-300/10 text-violet-200"><Zap className="h-4 w-4" aria-hidden="true" /></span>
              <span><span className="block text-[10px] text-slate-400">Active tasks</span><strong className="text-sm text-white">3</strong></span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><WalletCards className="h-4 w-4" aria-hidden="true" /></span>
              <span><span className="block text-[10px] text-slate-400">Rewards earned</span><strong className="text-sm text-white">$86.25</strong></span>
            </div>
          </div>
        </section>

        <div className="mb-5 rounded-xl border border-sky-300/20 bg-sky-300/[0.06] px-4 py-3 text-xs leading-5 text-sky-100/90" role="note">
          <span className="font-bold">Template preview:</span> wallet totals, payout activity, and task progress below are illustrative and do not represent real accounts or payments.
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(16rem,28fr)_minmax(0,72fr)] xl:gap-6">
          <aside id="activity" className="overflow-hidden rounded-2xl border border-slate-700/80 bg-brand-card shadow-[0_18px_48px_rgba(0,0,0,0.28)]" aria-labelledby="cashouts-title">
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-4 py-4 sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-30 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  </span>
                  <h2 id="cashouts-title" className="text-base font-bold text-white">Recent cash-outs</h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">Example payout activity</p>
              </div>
              <button
                type="button"
                onClick={() => setTickerPaused((paused) => !paused)}
                aria-label={tickerPaused ? 'Resume cash-out activity scrolling' : 'Pause cash-out activity scrolling'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200"
              >
                {tickerPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <div className="cashout-marquee-window h-[360px] overflow-hidden px-4 py-3 sm:h-[440px] sm:px-5" role="region" aria-label="Scrolling example cash-out entries">
              <div className={`cashout-marquee-track ${tickerPaused ? 'cashout-marquee-paused' : ''}`}>
                {[0, 1].map((copy) => (
                  <ul key={copy} className="space-y-3 pb-3" aria-hidden={copy === 1}>
                    {liveCashouts.map((cashout, cashoutIndex) => (
                      <li key={`${copy}-${cashoutIndex}-${cashout.handle}`} className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs font-extrabold ${{
                            teal: 'bg-teal-300/10 text-teal-200',
                            violet: 'bg-violet-300/10 text-violet-200',
                            amber: 'bg-amber-300/10 text-amber-200',
                            rose: 'bg-rose-300/10 text-rose-200',
                            blue: 'bg-blue-300/10 text-blue-200',
                          }[cashout.tone]}`} aria-hidden="true">
                            {cashout.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-slate-200">@{cashout.handle}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <MethodIcon method={cashout.method} /> {cashout.method}
                            </span>
                          </div>
                          <span className="text-right">
                            <span className="block text-sm font-extrabold tabular-nums text-emerald-300">{cashout.amount}</span>
                            <span className="mt-0.5 block text-[10px] text-slate-500">{cashout.time}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-700/70 px-4 py-3 sm:px-5">
              <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                Payout examples are anonymized sample content, not verified live transactions.
              </p>
            </div>
          </aside>

          <section id="earn" className="min-w-0" aria-labelledby="tasks-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Choose your next task</p>
                <h2 id="tasks-title" className="mt-1 text-xl font-extrabold text-white sm:text-2xl">Ways to earn</h2>
              </div>
              <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/80 p-1" role="group" aria-label="Filter tasks">
                <button
                  type="button"
                  aria-pressed={activeFilter === 'recommended'}
                  onClick={() => setActiveFilter('recommended')}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${activeFilter === 'recommended' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                >
                  Recommended
                </button>
                <button
                  type="button"
                  aria-pressed={activeFilter === 'all'}
                  onClick={() => setActiveFilter('all')}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${activeFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                >
                  All tasks
                </button>
              </div>
            </div>
            <div className="space-y-4" id="milestones">
              {visibleOffers.map((offer) => <MilestoneOfferCard key={offer.id} offer={offer} />)}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-slate-300">
                <Clock3 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                Task availability and completion times can vary.
              </p>
              <a href="/" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-200 hover:text-teal-100">
                Browse offers <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
        </>
        ) : dashboardView === 'arena' ? (
          <PvPLobbyArena />
        ) : (
          <SupportDesk embedded />
        )}
        </main>
      </div>

      {withdrawDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setWithdrawDialogOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-preview-title"
            aria-describedby="withdraw-preview-copy"
            ref={withdrawDialogRef}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
              <WalletCards className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 id="withdraw-preview-title" className="mt-4 text-lg font-bold text-white">Withdraw preview</h2>
            <p id="withdraw-preview-copy" className="mt-2 text-sm leading-6 text-slate-300">This template is not connected to a live wallet or payout service. No withdrawal has been requested.</p>
            <button
              type="button"
              onClick={() => setWithdrawDialogOpen(false)}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-2 text-sm font-extrabold text-[#07131a] hover:bg-teal-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-100"
            >
              Got it <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}
      <CommunityChat persistent username="Demo member" />
    </div>
  );
};
