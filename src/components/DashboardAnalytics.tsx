import React, { useState } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  MousePointerClick, 
  CheckCircle
} from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface DashboardAnalyticsProps {
  offers: Offer[];
  totalSubscribers: number;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  offers,
  totalSubscribers,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  // Compute live aggregates from offers
  const totalClicks = offers.reduce((acc, curr) => acc + curr.clicksCount, 0);
  const totalConversions = offers.reduce((acc, curr) => acc + curr.conversionsCount, 0);
  const overallConversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0.0';

  // Sort offers by clicks / conversions
  const sortedOffers = [...offers].sort((a, b) => b.clicksCount - a.clicksCount);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Activity Dashboard
            </h2>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-xs font-mono text-[#38bdf8]">
              Tracked Activity
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Counts shown here come only from activity recorded by this site. Merchant conversions and payouts are not tracked.
          </p>
        </div>

        {/* Time Filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#10141d] border border-white/10 self-start sm:self-auto font-mono text-xs">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 rounded transition-colors ${
              timeRange === '7d' ? 'bg-white/10 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 rounded transition-colors ${
              timeRange === '30d' ? 'bg-white/10 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1 rounded transition-colors ${
              timeRange === 'all' ? 'bg-white/10 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Clicks */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0e121a] border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">TOTAL REFERRAL CLICKS</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#38bdf8]">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-white">
              {totalClicks.toLocaleString()}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Across {offers.length} active affiliate promos
          </div>
        </div>

        {/* Total Conversions */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0e121a] border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">CONVERSIONS TRACKED</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
              {totalConversions.toLocaleString()}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Successful signup & bonus triggers
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0e121a] border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">TRACKED CONV. RATE</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-purple-400">
              {overallConversionRate}%
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Based only on recorded clicks and conversions
          </div>
        </div>

        {/* Merchant payouts are not observable from this site. */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0e121a] border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">MERCHANT PAYOUTS</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-amber-400">
              Not tracked
            </span>
            <span className="text-xs font-mono text-zinc-400">
              Confirm with the merchant
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            We do not have access to merchant payout records.
          </div>
        </div>

      </div>

      {/* Conversion Funnel Breakdown */}
      <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08]">
        <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Recorded Activity</span>
          <span className="text-zinc-500 font-normal text-xs">(No merchant confirmation)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.04]">
            <div className="text-xs font-mono text-zinc-400">Stage 1: Intent & Clicks</div>
            <div className="text-xl font-mono font-bold text-white mt-1">{totalClicks}</div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-[#38bdf8] h-full rounded-full w-full"></div>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-2">100% of tracked link navigations</div>
          </div>

          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.04]">
            <div className="text-xs font-mono text-zinc-400">Stage 2: Guide views</div>
            <div className="text-xl font-mono font-bold text-white mt-1">Not tracked</div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-white/20 h-full rounded-full w-0"></div>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-2">No guide-view event is recorded</div>
          </div>

          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.04]">
            <div className="text-xs font-mono text-zinc-400">Stage 3: Merchant conversion</div>
            <div className="text-xl font-mono font-bold text-zinc-400 mt-1">Not tracked</div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-white/20 h-full rounded-full w-0"></div>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-2">The merchant controls this information</div>
          </div>
        </div>
      </div>

      {/* Per-Offer Performance Table */}
      <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
            Offer Performance Breakdown
          </h3>
          <span className="text-xs font-mono text-zinc-400">
            Sorted by Total Clicks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-zinc-500 uppercase text-[10px]">
                <th className="pb-3 pl-2">Partner & Offer</th>
                <th className="pb-3 text-center">User Bonus</th>
                <th className="pb-3 text-center">Clicks</th>
                <th className="pb-3 text-center">Conversions</th>
                <th className="pb-3 text-center">Conv. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sortedOffers.map((offer) => {
                const rate = offer.clicksCount > 0 
                  ? ((offer.conversionsCount / offer.clicksCount) * 100).toFixed(1) 
                  : '0.0';
                return (
                  <tr key={offer.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo companyName={offer.company} slug={offer.companySlug} size="sm" />
                        <div>
                          <div className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                            {offer.company}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                            {offer.referralCode ? `Code: ${offer.referralCode}` : 'Direct Link'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 text-center text-emerald-400 font-semibold">
                      {offer.incentiveAmount}
                    </td>
                    <td className="py-3.5 text-center text-zinc-300">
                      {offer.clicksCount}
                    </td>
                    <td className="py-3.5 text-center text-white font-bold">
                      {offer.conversionsCount}
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        Number(rate) >= 15 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-zinc-400'
                      }`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
