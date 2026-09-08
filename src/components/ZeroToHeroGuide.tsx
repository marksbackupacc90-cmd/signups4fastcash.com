import React, { useState, useEffect } from 'react';
import { Offer } from '../types';
import {
  BLUEPRINT_PHASES,
  BLUEPRINT_STEPS,
  BLUEPRINT_MILESTONES,
  BlueprintStep,
} from '../data/zeroToHeroGuideData';
import { CompanyLogo } from './CompanyLogo';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Share2,
  RotateCcw,
  Layers,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ZeroToHeroGuideProps {
  liveOffers: Offer[];
  onClaimClick: (offerId: string) => void;
  onNavigateToOffers?: () => void;
}

export const ZeroToHeroGuide: React.FC<ZeroToHeroGuideProps> = ({
  liveOffers,
  onClaimClick,
  onNavigateToOffers,
}) => {
  // Filter mode
  const [filterMode, setFilterMode] = useState<'all' | 'no-direct-deposit' | 'under-48h'>('all');

  // Expanded card IDs
  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({
    'step-stake': true,
    'step-freecash': true,
  });

  // Track completed steps via localStorage
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('signups4fastcash_blueprint_progress');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Copy code state
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Sync completion to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('signups4fastcash_blueprint_progress', JSON.stringify(completedSteps));
    } catch {
      // ignore
    }
  }, [completedSteps]);

  // Helper to toggle step completion
  const toggleStepCompletion = (stepId: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Reset progress
  const handleResetProgress = () => {
    if (confirm('Reset your blueprint progress tracker back to $0.00?')) {
      setCompletedSteps({});
    }
  };

  // Toggle expand
  const toggleExpand = (stepId: string) => {
    setExpandedStepIds((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Copy referral code
  const handleCopyCode = (code: string, id: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Copy full summary to clipboard
  const handleCopyBlueprint = () => {
    const text = `💰 signups4fastcash.com — $0 to $1,000+ Zero-Capital Snowball Blueprint:
Phase 1 (Day 1, $0 Out-of-Pocket):
• Stake.us (Code: fastcash) -> $25 Free Cash instantly (0% capital)
• Freecash (Code: wintercash) -> $10 - $25 Instant Cash via PayPal/LTC
• Robinhood -> $10 Free Stock ($0 deposit)
Subtotal: $45 - $60 in hand

Phase 2 (Days 2-5, $1 Reinvested from Phase 1):
• Webull (Deposit $1) -> $36 - $200 Guaranteed Fractional Shares

Phase 3 (Days 5-14, $10 Reinvested):
• SoFi Checking (Deposit $10, Code: 72836365) -> $25 Instant Cash + 4.50% APY
• Capital One Shopping (Code: 090a1fc7) -> $30 - $100 Gift Card Rebates

Phase 4 (Days 14-30, Direct Deposit):
• Chime (Code: markwinters39) -> $100 Instant Cash Match on $200 payroll redirect
• Daily Stake.us Login Reloads -> $30/mo passive ($1/day)

Grand Total: $280 Conservative | $1,000+ Max Yield. Net Out-of-Pocket Cost: $0.00.
Guide URL: https://signups4fastcash.com`;

    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Helper to get matching live offer parameters (codes, urls)
  const getOfferForStep = (step: BlueprintStep): { code: string; url: string; liveOffer?: Offer } => {
    const match = liveOffers.find((o) => o.id === step.offerId);
    if (match) {
      return {
        code: match.referralCode || step.defaultCode,
        url: match.referralUrl || step.defaultUrl,
        liveOffer: match,
      };
    }
    return {
      code: step.defaultCode,
      url: step.defaultUrl,
    };
  };

  // Filtered steps
  const filteredSteps = BLUEPRINT_STEPS.filter((step) => {
    if (filterMode === 'no-direct-deposit') {
      return step.id !== 'step-chime';
    }
    if (filterMode === 'under-48h') {
      return step.phaseId === 'phase-1' || step.payoutSpeedCategory === 'immediate' || step.payoutSpeedCategory === 'within-24h';
    }
    return true;
  });

  // Calculate live user stats
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const totalStepsCount = BLUEPRINT_STEPS.length;
  const progressPercent = Math.round((completedCount / totalStepsCount) * 100);

  const accumulatedEarnings = BLUEPRINT_STEPS.reduce((sum, step) => {
    if (completedSteps[step.id]) {
      return sum + step.conservativePayout;
    }
    return sum;
  }, 0);

  const remainingPotential = BLUEPRINT_STEPS.reduce((sum, step) => {
    if (!completedSteps[step.id]) {
      return sum + step.conservativePayout;
    }
    return sum;
  }, 0);

  // Next step to tackle
  const nextStep = BLUEPRINT_STEPS.find((s) => !completedSteps[s.id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header & Overview Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c1424] via-[#090d16] to-[#07090e] border border-cyan-500/25 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          {/* Eyebrows */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              $0.00 OUT-OF-POCKET BLUEPRINT
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              100% Mathematical Leverage
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-zinc-400 text-xs font-mono">
              <Clock className="w-3.5 h-3.5" />
              Accurate Payout Speeds & Hold Times
            </span>
          </div>

          {/* Title & Core Concept */}
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1]">
              The $0 to $1,000+{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] via-[#38bdf8] to-emerald-400">
                Snowball Blueprint
              </span>
            </h1>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              How to start with literally <strong className="text-white font-semibold">$0.00 in your pocket</strong>, generate immediate seed cash from zero-deposit promotional credits, and compound every dollar into higher banking and brokerage matches until reaching <strong className="text-emerald-400 font-semibold">$650 to $1,250+ in clean, withdrawable cash</strong>.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#090d14]/80 border border-white/10">
              <div className="text-[11px] font-mono text-zinc-400 uppercase">Starting Outlay</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">$0.00</div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Zero personal funds</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090d14]/80 border border-white/10">
              <div className="text-[11px] font-mono text-zinc-400 uppercase">Conservative Cash</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">$280 - $410</div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Zero risk baseline</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090d14]/80 border border-white/10">
              <div className="text-[11px] font-mono text-zinc-400 uppercase">Max Stack Potential</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400 mt-0.5">$1,050 - $1,250+</div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">With direct deposit tier</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090d14]/80 border border-white/10">
              <div className="text-[11px] font-mono text-zinc-400 uppercase">Time to 1st Payout</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-0.5">&lt; 1 Hour</div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Stake & Freecash instant</div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyBlueprint}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-zinc-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                title="Copy textual speedrun blueprint to clipboard"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSummary ? 'Blueprint Copied!' : 'Copy Blueprint Text'}</span>
              </button>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
                  title="Reset tracker"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Progress</span>
                </button>
              )}
            </div>

            {onNavigateToOffers && (
              <button
                type="button"
                onClick={onNavigateToOffers}
                className="px-3.5 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-mono text-cyan-300 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>View Full Offers Feed</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Progress Bar & Snowball Odometer */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Your Snowball Progress:</span>
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5">
              <span className="text-emerald-400">${accumulatedEarnings.toFixed(2)}</span>
              <span className="text-zinc-500 text-sm font-normal"> earned so far </span>
              <span className="text-zinc-400 text-xs font-normal">
                (Remaining Potential: <strong className="text-cyan-300">${remainingPotential.toFixed(2)}</strong>)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">
              Steps Completed: <strong className="text-white">{completedCount}</strong> of {totalStepsCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-[#141824] rounded-full h-3.5 overflow-hidden p-0.5 border border-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-[#00f2fe] to-[#38bdf8] rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 2)}%` }}
          ></div>
        </div>

        {/* Next step hint */}
        {nextStep && (
          <div className="pt-2 flex items-center justify-between gap-3 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-amber-400 font-bold">▶ NEXT RECOMMENDED ACTION:</span>
              <span className="text-white font-semibold">Step {nextStep.stepNumber}: {nextStep.company}</span>
              <span className="text-emerald-400 font-bold">+{nextStep.expectedPayout}</span>
            </div>
            <span className="text-zinc-500">
              Check off steps below as you complete them to track your odometer!
            </span>
          </div>
        )}
      </div>

      {/* Visual Snowball Pipeline Flowchart */}
      <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            The 4-Phase Compounding Snowball Flowchart
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            How $0 rolls into $1,000+
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {BLUEPRINT_PHASES.map((phase, idx) => (
            <div
              key={phase.id}
              className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] flex flex-col justify-between space-y-2 relative"
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400 font-bold">{phase.timeframe}</span>
                <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-300 text-[10px]">
                  Phase {idx + 1}
                </span>
              </div>
              <div>
                <div className="text-sm font-bold font-mono text-white">{phase.title.split(':')[1] || phase.title}</div>
                <div className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">{phase.targetAccumulated}</div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {phase.description}
              </p>
              <div className="pt-2 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500">
                Capital Required: <strong className="text-zinc-300">{phase.capitalOutlay}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Mode Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#10141d] border border-white/[0.06] text-xs font-mono">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All 10 Steps ($0 to $1,000+ Max Blueprint)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('no-direct-deposit')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              filterMode === 'no-direct-deposit'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            No Direct-Deposit ($0 to $350 Speedrun)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('under-48h')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              filterMode === 'under-48h'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Fast Cash (Under 48 Hours)
          </button>
        </div>

        <span className="text-xs font-mono text-zinc-500">
          Showing {filteredSteps.length} of {BLUEPRINT_STEPS.length} Steps
        </span>
      </div>

      {/* Step by Step Cards */}
      <div className="space-y-6">
        {filteredSteps.map((step) => {
          const isCompleted = !!completedSteps[step.id];
          const isExpanded = !!expandedStepIds[step.id];
          const { code, url } = getOfferForStep(step);
          const isCopied = copiedCodeId === step.id;

          return (
            <div
              key={step.id}
              id={`blueprint-${step.id}`}
              className={`rounded-xl border transition-all ${
                isCompleted
                  ? 'bg-[#0a0f16]/90 border-emerald-500/40 opacity-90 shadow-md shadow-emerald-950/20'
                  : 'bg-[#0e121a] border-white/[0.08] hover:border-white/[0.16] shadow-xl'
              }`}
            >
              {/* Card Header Bar */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06]">
                <div className="flex items-start sm:items-center gap-3.5">
                  <CompanyLogo companyName={step.company} size="md" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
                        STEP {step.stepNumber}
                      </span>
                      <span className="text-base font-bold font-mono text-white">{step.company}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold">
                        +{step.expectedPayout}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 text-[11px] font-mono">
                        {step.phaseTimeframe}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl">{step.summary}</p>
                  </div>
                </div>

                {/* Right: Toggle Completed + Expand Controls */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleStepCompletion(step.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 border border-white/10'
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                        <span>Completed!</span>
                      </>
                    ) : (
                      <>
                        <span className="w-3.5 h-3.5 rounded border border-zinc-500 inline-block" />
                        <span>Mark Done</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpand(step.id)}
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 bg-[#121622] text-xs font-mono border-b border-white/[0.04]">
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block">Capital Required</span>
                  <span className="font-bold text-white">{step.capitalRequired}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block">Payout Speed</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {step.payoutTimeframe.split('(')[0] || step.payoutTimeframe}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block">Withdrawal Method</span>
                  <span className="font-semibold text-zinc-300 truncate block">{step.withdrawalMethod}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block">Conservative Yield</span>
                  <span className="font-bold text-cyan-300">+${step.conservativePayout}.00 cash</span>
                </div>
              </div>

              {/* Detailed Expandable Body */}
              {isExpanded && (
                <div className="p-5 space-y-4">
                  {/* Step Walkthrough */}
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Execution Speedrun Walkthrough:
                    </div>
                    <div className="space-y-1.5">
                      {step.walkthrough.map((instruction, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{instruction}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Honest Trap Callout */}
                  <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <strong className="font-mono text-amber-300 uppercase block">The Trap to Avoid:</strong>
                      <p className="text-zinc-300 leading-relaxed">{step.honestTrap}</p>
                    </div>
                  </div>

                  {/* Pro Tip / Mathematical Hack */}
                  <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <strong className="font-mono text-emerald-300 uppercase block">Pro Blueprint Tip:</strong>
                      <p className="text-zinc-300 leading-relaxed">{step.proTip}</p>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {code && (
                        <div className="flex items-center bg-[#090b0e] px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
                          <span className="text-zinc-500 mr-1.5">CODE:</span>
                          <span className="text-emerald-400 font-bold mr-2">{code}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(code, step.id)}
                            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy Code"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}

                      <span className="text-[11px] font-mono text-zinc-500">
                        {step.payoutTimeframe}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onClaimClick(step.offerId)}
                        className="px-4 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#38bdf8] text-black font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/40 cursor-pointer active:scale-[0.98]"
                      >
                        <span>Claim {step.company} Step</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Blueprint Strategy FAQs & Mathematical Rules */}
      <div className="p-6 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
        <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          The 4 Golden Rules of the $0 Snowball
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-1.5">
            <h4 className="font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">1.</span> What if I literally have $0 in my bank right now?
            </h4>
            <p className="text-zinc-400 leading-relaxed">
              Start with <strong>Stake.us (Code: fastcash)</strong> and <strong>Freecash (Code: wintercash)</strong>. Neither requires a bank account or a deposit to get started. You can cash out directly to PayPal or cryptocurrency (Litecoin has under $0.05 network fees), giving you the first $35 to fund Stage 2.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-1.5">
            <h4 className="font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">2.</span> How do I wash the Stake.us $25 with 0% risk?
            </h4>
            <p className="text-zinc-400 leading-relaxed">
              Social sweepstakes require playing promotional credits 1x before withdrawing. Open the Stake Originals game <strong>Dice</strong>, set win chance to 98% or 99%, and place 10¢ or 25¢ bets on auto-roll. This satisfies the 1x rollover with near 100% statistical preservation so you can withdraw to crypto.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-1.5">
            <h4 className="font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">3.</span> How do I split direct deposit for Chime's $100?
            </h4>
            <p className="text-zinc-400 leading-relaxed">
              You do <strong>not</strong> need to switch your whole salary. In employer portals like ADP, Gusto, Workday, or gig apps (Uber, DoorDash), select "Add Direct Deposit" and choose a <strong>Fixed Dollar Amount of $200.00</strong> to Chime. Keep the remainder going to your primary bank.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-1.5">
            <h4 className="font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">4.</span> Will opening these accounts hurt my credit score?
            </h4>
            <p className="text-zinc-400 leading-relaxed">
              <strong>No.</strong> None of the featured accounts perform hard credit inquiries. SoFi, Chime, Robinhood, and Webull only perform standard soft identity verifications (KYC) to comply with FDIC/SEC regulations. Your credit score is completely untouched.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
