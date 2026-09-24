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
  const [showCompletionReport, setShowCompletionReport] = useState(false);
  const [completionReportStatus, setCompletionReportStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const verificationDate = offer.verifiedAt ? Date.parse(offer.verifiedAt) : NaN;
  const isRecentlyVerified = Number.isFinite(verificationDate) && verificationDate >= Date.now() - 30 * 24 * 60 * 60 * 1000;

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
    const openedWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(targetUrl);
  };
  const claimUrl = offer.referralUrl || offer.officialMerchantUrl;

  const handleCompletionReport = async () => {
    setCompletionReportStatus('submitting');
    try {
      const response = await fetch(`/api/offers/${offer.id}/completion-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      if (!response.ok) throw new Error('Could not submit completion report.');
      setCompletionReportStatus('submitted');
    } catch {
      setCompletionReportStatus('error');
    }
  };


  return (
    <div 
      id={`offer-card-${offer.id}`}
      className="offer-card retro-window group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[#171a22]/95 shadow-[0_18px_50px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:shadow-[0_24px_60px_rgba(0,0,0,0.32),0_0_30px_rgba(45,212,238,0.1)]"
    >
      <div className="relative flex h-48 shrink-0 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_20%_100%,rgba(45,212,238,0.2),transparent_42%),linear-gradient(145deg,#263747,#0d141f_78%)]">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute inset-x-8 top-4 h-20 rounded-full bg-cyan-200/10 blur-3xl" />
        <a
          href={claimUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onClaimClick(offer.id)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Open ${offer.title} offer from ${offer.company}`}
          className="relative z-10 flex h-full w-full items-center justify-center transition-transform duration-300 hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2dd4ee]/70"
        >
          <CompanyLogo
            companyName={offer.company}
            slug={offer.companySlug}
            logoUrl={offer.logoUrl}
            size="lg"
            className="rounded-[1.6rem] bg-white/[0.08] p-2 shadow-[0_18px_35px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-md"
          />
        </a>
      </div>

      <div className="flex flex-1 flex-col bg-[linear-gradient(180deg,#1b1e27_0%,#171a22_100%)] p-4 sm:p-5">
        <div className="flex items-start gap-2">
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onClaimClick(offer.id)}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={`Open ${offer.title} offer from ${offer.company}`}
            className="min-w-0 flex-1 text-left transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4ee]/70 rounded-lg"
          >
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[1.05rem] font-black tracking-[-0.01em] text-white transition-colors group-hover:text-[#2dd4ee] leading-tight">
                {offer.title}
              </h2>

              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-zinc-400">{offer.honestTruth.summary}</p>
            </div>
          </a>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              aria-expanded={showDetails}
              aria-label={`${showDetails ? 'Hide' : 'Show'} details for ${offer.company}`}
              className="focus-ring inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.06] p-2.5 text-[10px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.12] hover:text-white sm:text-xs"
            >
              <span className="sr-only">{showDetails ? 'Hide' : 'Details'} offer details</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-400">
          <span className="text-amber-300">★ <span className="text-zinc-200">{offer.honestTruth.trustScore / 20}</span></span>
          <span>{offer.difficulty}</span>
          <span className={`inline-flex items-center gap-1 ${isRecentlyVerified ? 'text-emerald-300' : 'text-amber-200'}`}>
            <ShieldCheck className="h-3 w-3" /> {isRecentlyVerified ? 'Terms checked' : 'Review terms'}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-[10px] text-zinc-500">
          <span className="truncate">{offer.company}</span>
          <span className="shrink-0">{offer.payoutSpeed}</span>
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
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/[0.06] pb-1.5">
                <span>Follow these steps in order</span>
                <p className="mt-1 text-[10px] font-sans normal-case tracking-normal text-zinc-500">
                  Do not skip a step. The provider controls eligibility, approval, and payout.
                </p>
              </div>
              <ol className="space-y-2">
                {offer.speedrunHints.map((hint) => (
                  <li key={hint.step} className="flex flex-col gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 sm:flex-row">
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
                      {hint.screenshotUrl && (
                        <img
                          src={hint.screenshotUrl}
                          alt={hint.screenshotAlt || `Screenshot showing step ${hint.step}`}
                          className="mt-2 max-h-52 w-full rounded-md border border-white/10 object-contain object-left"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
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

            <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
              <button
                type="button"
                onClick={() => setShowCompletionReport((current) => !current)}
                className="focus-ring flex min-h-11 w-full items-center justify-between text-left text-[11px] font-mono text-zinc-300"
                aria-expanded={showCompletionReport}
              >
                <span>Did you complete this offer?</span>
                {showCompletionReport ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showCompletionReport && (
                <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-zinc-400">
                  <p>This is self-reported only. It will not be counted as a verified conversion.</p>
                  {completionReportStatus === 'submitted' ? (
                    <p className="mt-2 text-emerald-300">Thanks — your report was recorded for review.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCompletionReport}
                      disabled={completionReportStatus === 'submitting'}
                      className="focus-ring mt-2 min-h-11 rounded-md border border-emerald-300/30 px-3 py-2 text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-60"
                    >
                      {completionReportStatus === 'submitting' ? 'Submitting...' : 'Yes, I completed it'}
                    </button>
                  )}
                  {completionReportStatus === 'error' && <p className="mt-2 text-rose-300">We could not record that report. Please try again.</p>}
                </div>
              )}
            </div>

            <div className="mt-2 border-t border-white/[0.06] pt-2 text-center text-[9px] text-zinc-500">
            <div className="mb-2 flex flex-wrap justify-center gap-1.5">
              {offer.honestTruth.idVerificationRequired && <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2 py-0.5 text-amber-200">ID verification may be required</span>}
              {!/\$0|no deposit/i.test(offer.depositRequired) && <span className="rounded-full border border-orange-300/20 bg-orange-300/5 px-2 py-0.5 text-orange-200">Purchase or deposit may be required</span>}
              {offer.availability.toLowerCase().includes('select') && <span className="rounded-full border border-violet-300/20 bg-violet-300/5 px-2 py-0.5 text-violet-200">Limited eligibility</span>}
              </div>
            <span className="text-emerald-400">Direct partner link</span>
            {' '}• payout by {offer.company} • no extra cost
            <div className="mt-0.5 text-zinc-600">
              Confirm current terms before applying.
            </div>
            </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
