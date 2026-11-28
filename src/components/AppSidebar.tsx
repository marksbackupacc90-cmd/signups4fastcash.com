import React from 'react';
import { Gift, Gamepad2, Handshake, LayoutGrid, ShieldCheck, UserRound, WalletCards } from 'lucide-react';

export type AppSection = 'offers' | 'games' | 'daily' | 'wallet' | 'referrals' | 'admin';

interface AppSidebarProps {
  activeTab: AppSection;
  onSelect: (section: AppSection) => void;
  showAdmin?: boolean;
}

const navigation: { section: AppSection; label: string; icon: React.ElementType }[] = [
  { section: 'offers', label: 'Offers', icon: LayoutGrid },
  { section: 'games', label: 'Games', icon: Gamepad2 },
  { section: 'daily', label: 'Daily spin', icon: Gift },
  { section: 'wallet', label: 'Wallet', icon: WalletCards },
  { section: 'referrals', label: 'Invite & earn', icon: Handshake },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({ activeTab, onSelect, showAdmin = false }) => {
  const items = showAdmin
    ? [...navigation, { section: 'admin' as const, label: 'Admin', icon: ShieldCheck }]
    : navigation;

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-60 border-r border-white/10 bg-[#0b1019] px-3 py-5 md:block">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Explore</p>
        <nav aria-label="Main navigation" className="mt-3 space-y-1">
          {items.map(({ section, label, icon: Icon }) => (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              aria-current={activeTab === section ? 'page' : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                activeTab === section
                  ? 'bg-cyan-300/10 text-cyan-100 ring-1 ring-inset ring-cyan-300/20'
                  : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${activeTab === section ? 'text-cyan-200' : 'text-zinc-500'}`} aria-hidden="true" />
              {label}
              {section === 'daily' && <span className="ml-auto rounded-full bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold text-amber-100">DAILY</span>}
            </button>
          ))}
        </nav>
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <p className="text-xs font-bold text-white">Earn with clarity</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">Review offer requirements before you sign up. Rewards and availability depend on each provider’s terms.</p>
        </div>
      </aside>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-[#0b1019]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-xl md:hidden">
        {navigation.map(({ section, label, icon: Icon }) => (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            aria-current={activeTab === section ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-semibold ${
              activeTab === section ? 'text-cyan-200' : 'text-zinc-400'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
};
