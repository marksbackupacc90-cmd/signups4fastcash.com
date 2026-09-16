import React, { useState } from 'react';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Zap, 
  ShieldCheck, 
} from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface OfferCardProps {
  offer: Offer;
  onClaimClick: (offerId: string) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer, onClaimClick }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showTruth, setShowTruth] = useState(false);
  const [copied, setCopied] = useState(false);
  const updatedLabel = new Date(offer.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const reviewLabel = new Date(offer.verifiedAt || offer.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const isReviewed = offer.verificationStatus === 'reviewed';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (offer.referralCode) {
      navigator.clipboard.writeText(offer.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClaim = () => {
    onClaimClick(offer.id);
    const targetUrl = offer.referralUrl || offer.officialMerchantUrl;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };


  return (
    <div 
      id={`offer-card-${offer.id}`}
      className="offer-card retro-window group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a1220] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-[#2dd4ee]/30 hover:shadow-[0_0_18px_rgba(45,212,238,0.12)]"
    >
      <div className="flex flex-1 flex-col bg-[#0d1724] p-5">
        
        {/* Header: Company Logo next to Title + Incentive Badge */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClaim}
            aria-label={`Open ${offer.title} offer from ${offer.company}`}
            className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4ee]/70 rounded-lg"
          >
            <CompanyLogo
              companyName={offer.company}
              slug={offer.companySlug}
              logoUrl={offer.logoUrl}
              size="md"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-mono font-bold text-emerald-300">
                    {offer.incentiveAmount}
                  </span>
                </div>
                <h2 className="mt-0.5 text-base sm:text-lg font-bold text-white transition-colors group-hover:text-[#2dd4ee] leading-snug">
                  {offer.title}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-mono text-zinc-400">
                    {offer.difficulty}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{offer.honestTruth.summary}</p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              aria-expanded={showDetails}
              aria-label={`${showDetails ? 'Hide' : 'Show'} details for ${offer.company}`}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-white/[0.08] px-2.5 py-2 text-[10px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.14] hover:text-white sm:text-xs"
            >
              <span>{showDetails ? 'Hide info' : 'More info'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="animate-in fade-in duration-200">
            <div className="mt-2 grid grid-cols-1 gap-1.5 rounded-lg border border-white/[0.06] bg-[#141824] p-1.5 text-center text-[11px] font-mono sm:grid-cols-3">
              <div className="flex min-h-11 flex-col justify-center rounded border border-white/[0.04] bg-white/[0.02] px-2 py-1">
                <span className="text-[10px] text-zinc-500">DEPOSIT</span>
                <span className="truncate font-medium text-zinc-200">{offer.depositRequired}</span>
              </div>
              <div className="flex min-h-11 flex-col justify-center rounded border border-white/[0.04] bg-white/[0.02] px-2 py-1">
                <span className="text-[10px] text-zinc-500">PAYOUT</span>
                <span className="truncate font-medium text-zinc-200">{offer.payoutSpeed}</span>
              </div>
              <div className="flex min-h-11 flex-col justify-center rounded border border-white/[0.04] bg-white/[0.02] px-2 py-1">
                <span className="text-[10px] text-zinc-500">EFFORT</span>
                <span className="truncate font-medium text-emerald-400">{offer.difficulty}</span>
              </div>
            </div>

            {/* Referral Code Box (if present) */}
            {offer.referralCode && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-[#2dd4ee]/20 bg-[#0f1d2d] p-1.25 text-[9px] font-mono">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[8px] text-[#2dd4ee]">CODE:</span>
              <span className="truncate font-bold tracking-wider text-zinc-200 select-all">
                {offer.referralCode}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="focus-ring ml-2 shrink-0 rounded bg-white/[0.06] px-1.5 py-0.75 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Copy referral code"
              aria-label={`Copy referral code ${offer.referralCode}`}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-emerald-400 font-bold">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[9px]">COPY</span>
                </>
              )}
            </button>
              </div>
            )}

            {/* Interactive Expanders: Speedrun Hints and Honest Truth */}
            <div className="mt-1.5 space-y-1">

          {/* Speedrun Hints Toggle Button */}
          <button
            onClick={() => setShowHints(!showHints)}
            aria-expanded={showHints}
            className="focus-ring flex w-full items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] font-mono text-zinc-300 transition-colors hover:border-white/15"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Zap className="w-3.5 h-3.5 text-zinc-400" />
              Easy steps ({offer.speedrunHints.length})
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              {showHints ? 'Hide guide' : 'Show steps'}
              {showHints ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {/* Speedrun Hints Expanded Panel */}
          {showHints && (
            <div className="p-3 rounded-lg bg-[#07090e] border border-blue-500/20 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/[0.06] pb-1.5 flex items-center justify-between">
                <span>Simplified Walkthrough</span>
                <span className="text-emerald-400">Fast & Efficient</span>
              </div>
              <ol className="space-y-2">
                {offer.speedrunHints.map((hint) => (
                  <li key={hint.step} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/30 text-[#38bdf8] font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {hint.step}
                    </span>
                    <div className="min-w-0">
                      <p className="text-zinc-200 leading-relaxed font-sans">{hint.instruction}</p>
                      {hint.proTip && (
                        <p className="text-[11px] text-amber-300/90 font-mono mt-0.5">
                          💡 Pro-Tip: {hint.proTip}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Honest Truth & No Bull Crap Toggle */}
          <button
            onClick={() => setShowTruth(!showTruth)}
            aria-expanded={showTruth}
            className="focus-ring flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-[#141824] px-2 py-1 text-[11px] font-mono text-zinc-300 transition-colors hover:border-white/15"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Honest truth
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <span className="text-emerald-400 font-semibold">{offer.honestTruth.trustScore}/100</span>
              {showTruth ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {/* Honest Truth Expanded Panel */}
          {showTruth && (
            <div className="p-3 rounded-lg bg-[#07090e] border border-white/10 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-amber-300 font-mono text-[11px]">THE CATCH & FINE PRINT:</strong>
                  <p className="text-amber-200/90 leading-relaxed font-sans">{offer.honestTruth.theCatch}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-1">
                <div>
                  <span className="text-zinc-500 block">MIN HOLD TIME:</span>
                  <span className="text-zinc-300">{offer.honestTruth.minimumHoldTime}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">ID VERIFICATION:</span>
                  <span className="text-zinc-300">{offer.honestTruth.idVerificationRequired ? 'Required (Gov ID/SSN)' : 'None Required'}</span>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 font-sans border-t border-white/[0.06] pt-1.5">
                <span className="text-zinc-500 font-mono">FEES AUDIT: </span>
                {offer.honestTruth.hiddenFeesWarning}
              </div>
            </div>
          )}

            <button
              type="button"
              onClick={handleClaim}
              id={`claim-offer-btn-${offer.id}`}
              aria-label={`Get ${offer.incentiveAmount} offer from ${offer.company}`}
              className="focus-ring group/btn mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#2dd4ee]/60 bg-[#2dd4ee] px-3 py-2.5 text-xs font-semibold text-[#06131a] shadow-sm transition-colors hover:bg-[#67e8f9] active:scale-[0.99]"
            >
              <span>Get {offer.incentiveAmount} offer from {offer.company}</span>
              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
            </button>

            <div className="mt-2 border-t border-white/[0.06] pt-2 text-center text-[9px] text-zinc-500">
              <span className="text-emerald-400">Direct partner link</span>
              {' '}• payout by {offer.company} • no extra cost
              <div className="mt-0.5 text-zinc-600">
                {isReviewed && offer.verifiedAt ? `Terms checked ${reviewLabel}.` : `Last updated ${updatedLabel}.`}
                {' '}Confirm eligibility and current terms on the merchant site.
              </div>
            </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
