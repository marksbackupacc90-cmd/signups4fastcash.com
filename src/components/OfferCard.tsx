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
  const statusLabel = isReviewed ? 'Verified' : 'Updated';
  const isSofiOffer = offer.companySlug === 'sofi' || offer.company.toLowerCase().includes('sofi');
  const sofiPaths = [
    {
      label: 'Banking',
      detail: 'Up to $125',
      url: offer.referralUrl || offer.officialMerchantUrl,
    },
    {
      label: 'Credit',
      detail: '$10 points',
      url: 'https://www.sofi.com/invite/coach?gcp=65212857-4fac-4777-b80b-2d77cf7da92f&isAliasGcp=false&siid=db756f4b-a5e2-44d8-a8a3-439da7165e18',
    },
    {
      label: 'Invest',
      detail: '$75 referral',
      url: 'https://www.sofi.com/invite/invest?gcp=a5844ce4-c8ad-4de4-af76-78b6d6034541&isAliasGcp=false&siid=8cabebd2-fb23-4458-9e3a-0fb8a4aeb102',
    },
    {
      label: 'Crypto',
      detail: '$50 SOFiD',
      url: 'https://www.sofi.com/invite/crypto?gcp=00ede0ca-0fbe-458d-ab3b-b9067218b083&isAliasGcp=false&siid=cdfa7ad0-802f-4a66-8416-e61c277dd7dd',
    },
  ];

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
      className="offer-card retro-window group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,_rgba(45,212,238,0.08),transparent_28%),#0a1220] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-[#2dd4ee]/30 hover:shadow-[0_0_18px_rgba(45,212,238,0.12)]"
    >
      <div className="flex flex-1 flex-col bg-[#0d1724] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleClaim}
            aria-label={`Open ${offer.title} offer from ${offer.company}`}
            className="flex min-w-0 flex-1 items-start gap-3 text-left transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4ee]/70 rounded-lg"
          >
            <CompanyLogo
              companyName={offer.company}
              slug={offer.companySlug}
              logoUrl={offer.logoUrl}
              size="md"
              className="shrink-0 mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-emerald-300">
                  {offer.incentiveAmount}
                </span>
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[8px] font-mono uppercase tracking-[0.12em] text-zinc-300">
                  {statusLabel}
                </span>
              </div>

              <h2 className="mt-2 text-base sm:text-[1.05rem] font-black text-white transition-colors group-hover:text-[#2dd4ee] leading-tight">
                {offer.title}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-400">
                <span className="inline-flex rounded-full bg-white/[0.04] px-2 py-0.5 text-zinc-300">
                  {offer.difficulty}
                </span>
                <span className="text-zinc-600">•</span>
                <span>{reviewLabel}</span>
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">{offer.honestTruth.summary}</p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              aria-expanded={showDetails}
              aria-label={`${showDetails ? 'Hide' : 'Show'} details for ${offer.company}`}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.08] hover:text-white sm:text-xs"
            >
              <span>{showDetails ? 'Hide' : 'Details'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isSofiOffer && (
          <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono">
              <span className="font-bold uppercase tracking-[0.1em] text-cyan-200">SoFi paths</span>
              <span className="text-zinc-600">•</span>
              {sofiPaths.map((path, index) => (
                <React.Fragment key={path.label}>
                  {index > 0 && <span className="text-zinc-600">→</span>}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.open(path.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="focus-ring rounded px-1 text-left text-zinc-300 transition-colors hover:bg-cyan-300/10 hover:text-cyan-100"
                    title={`Open SoFi ${path.label} referral`}
                  >
                    {path.label}
                    <span className="ml-1 text-zinc-500">({path.detail})</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">
              Open each path separately and review its official terms. You can choose options that do not require a deposit or bank link.
            </p>
          </div>
        )}

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
              <div className="flex min-h-11 flex-col justify-center rounded border border-white/[0.04] bg-white/[0.02] px-2 py-1 sm:col-span-3">
                <span className="text-[10px] text-zinc-500">AVAILABILITY</span>
                <span className="font-medium text-zinc-200">{offer.availability}</span>
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
              aria-label={`Claim the ${offer.company} offer`}
              className="focus-ring group/btn mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#2dd4ee]/60 bg-[#2dd4ee] px-3 py-2.5 text-xs font-semibold text-[#06131a] shadow-[0_0_16px_rgba(45,212,238,0.18)] transition-all hover:bg-[#67e8f9] active:scale-[0.99]"
            >
              <span>Claim offer</span>
              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
            </button>

            <div className="mt-2 border-t border-white/[0.06] pt-2 text-center text-[9px] text-zinc-500">
              <span className="text-emerald-400">Direct partner link</span>
              {' '}• payout by {offer.company} • no extra cost
              <div className="mt-0.5 text-zinc-600">
                {isReviewed && offer.verifiedAt ? `Terms checked ${reviewLabel}.` : `Last updated ${updatedLabel}.`}
                {' '}Confirm current terms before applying.
              </div>
            </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
