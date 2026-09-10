import React, { useState } from 'react';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Zap, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  HelpCircle,
  Cpu
} from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface OfferCardProps {
  offer: Offer;
  onClaimClick: (offerId: string) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer, onClaimClick }) => {
  const [showHints, setShowHints] = useState(false);
  const [showTruth, setShowTruth] = useState(false);
  const [copied, setCopied] = useState(false);

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
      className="group relative rounded-lg bg-[#0e121a] border border-white/[0.07] hover:border-white/15 transition-colors duration-200 overflow-hidden flex flex-col"
    >
      {/* Top accent border line on hover */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#00f2fe]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        
        {/* Header: Company Logo next to Title + Incentive Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Company Logo next to offer title */}
            <CompanyLogo 
              companyName={offer.company} 
              slug={offer.companySlug} 
              size="md"
              className="mt-0.5" 
            />
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-sm font-mono uppercase tracking-wider text-zinc-300 font-semibold truncate">
                  {offer.company}
                </span>
                {offer.featured && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-mono text-zinc-300">
                    <Sparkles className="w-2.5 h-2.5" />
                    Top Pick
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-[#38bdf8] transition-colors leading-snug mt-1">
                {offer.title}
              </h2>
            </div>
          </div>

          {/* Cash Incentive Pill */}
          <div className="shrink-0 text-right">
            <div className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold text-sm sm:text-base">
              {offer.incentiveAmount}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-1">
              Direct to User
            </div>
          </div>
        </div>

        {/* Key Quick-Specs Badges (Mobile-friendly, responsive) */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#141824]/50 p-2 rounded-lg">
          <div>
            <span className="text-zinc-500 block text-[10px]">DEPOSIT REQ</span>
            <span className="text-zinc-200 font-medium truncate block">{offer.depositRequired}</span>
          </div>
          <div className="border-x border-white/[0.06] px-1">
            <span className="text-zinc-500 block text-[10px]">PAYOUT SPEED</span>
            <span className="text-zinc-200 font-medium truncate block">{offer.payoutSpeed}</span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[10px]">EFFORT</span>
            <span className="text-emerald-400 font-medium truncate block">{offer.difficulty}</span>
          </div>
        </div>

        {/* Referral Code Box (if present) */}
        {offer.referralCode && (
          <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-[#141824] text-xs font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-500 text-[11px]">PROMO CODE:</span>
              <span className="text-zinc-200 font-bold tracking-wider select-all truncate">
                {offer.referralCode}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="px-2 py-1 rounded bg-white/[0.06] hover:bg-white/10 text-zinc-300 hover:text-white transition-colors flex items-center gap-1 shrink-0 ml-2"
              title="Copy referral code"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-bold">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">COPY</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Interactive Expanders: Omni-AI Council, Speedrun Hints & Honest Truth */}
        <div className="mt-4 space-y-2">

          {/* Speedrun Hints Toggle Button */}
          <button
            onClick={() => setShowHints(!showHints)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] hover:border-white/15 text-xs font-mono text-zinc-300 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Zap className="w-3.5 h-3.5 text-zinc-400" />
              Easy steps ({offer.speedrunHints.length})
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              {showHints ? 'Hide Guide' : 'Show Easy Steps'}
              {showHints ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {/* Speedrun Hints Expanded Panel */}
          {showHints && (
            <div className="p-3.5 rounded-lg bg-[#07090e] border border-blue-500/20 text-xs space-y-2.5 animate-in fade-in duration-200">
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
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/[0.06] hover:border-white/15 text-xs font-mono text-zinc-300 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              The Honest Truth & The Catch
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <span className="text-emerald-400 font-semibold">{offer.honestTruth.trustScore}/100 Trust</span>
              {showTruth ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {/* Honest Truth Expanded Panel */}
          {showTruth && (
            <div className="p-3.5 rounded-lg bg-[#07090e] border border-white/10 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{offer.honestTruth.summary}</span>
              </div>
              
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

        </div>

        {/* Claim Call to Action */}
        <div className="mt-5 pt-3 border-t border-white/[0.06]">
          <button
            onClick={handleClaim}
            id={`claim-offer-btn-${offer.id}`}
            className="w-full py-2.5 px-4 rounded-lg bg-white text-black font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm group/btn active:scale-[0.99]"
          >
            <span>Claim Offer on {offer.company}</span>
            <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
          
          <div className="mt-2 text-center text-[10px] font-mono text-zinc-500 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Direct Partner Link • Payout handled directly by {offer.company}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
