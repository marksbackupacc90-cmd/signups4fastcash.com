import React, { useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, X } from 'lucide-react';
import { Offer } from '../types';

interface OfferDetailsModalProps {
  offer: Offer;
  onClose: () => void;
  onClaimClick: (offerId: string) => void;
}

const Disclosure: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <details className="group rounded-xl border border-white/[0.08] bg-white/[0.025]">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-200 marker:hidden">
      {title}
      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-white/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-300">
      {children}
    </div>
  </details>
);

export const OfferDetailsModal: React.FC<OfferDetailsModalProps> = ({ offer, onClose, onClaimClick }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const claimUrl = offer.referralUrl || offer.officialMerchantUrl;

  const copyCode = async () => {
    if (!offer.referralCode) return;
    try {
      await navigator.clipboard.writeText(offer.referralCode);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
    }
  };

  const claim = () => {
    onClaimClick(offer.id);
    const openedWindow = window.open(claimUrl, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(claimUrl);
  };

  const reportCompletion = async () => {
    setCompletionStatus('submitting');
    try {
      const response = await fetch(`/api/offers/${offer.id}/completion-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      if (!response.ok) throw new Error('Could not submit completion report.');
      setCompletionStatus('submitted');
    } catch {
      setCompletionStatus('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`offer-modal-title-${offer.id}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#0d1724] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-cyan-300">{offer.company}</p>
            <h2 id={`offer-modal-title-${offer.id}`} className="truncate text-lg font-bold text-white">{offer.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close offer details">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-zinc-300">{offer.honestTruth.summary}</p>
          <div className="mt-4 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.05] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/70">Advertised reward</p>
            <p className="mt-1 text-xl font-bold text-white">{offer.incentiveAmount}</p>
            <p className="mt-2 text-xs text-zinc-400">
              {offer.depositRequired} deposit <span className="px-1 text-zinc-600">·</span> {offer.payoutSpeed} payout
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <Disclosure title={`How to earn · ${offer.speedrunHints.length} steps`}>
              <ol className="space-y-3">
                {offer.speedrunHints.map((hint) => (
                  <li key={hint.step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-xs font-bold text-cyan-200">{hint.step}</span>
                    <div>
                      <p>{hint.instruction}</p>
                      {hint.proTip && <p className="mt-1 text-xs text-amber-200/80">Tip: {hint.proTip}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Disclosure>

            <Disclosure title="Requirements & payout details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><dt className="text-zinc-500">Effort</dt><dd className="mt-0.5 text-zinc-200">{offer.difficulty}</dd></div>
                <div><dt className="text-zinc-500">Availability</dt><dd className="mt-0.5 text-zinc-200">{offer.availability}</dd></div>
                <div className="col-span-2"><dt className="text-zinc-500">Payout timing</dt><dd className="mt-0.5 text-zinc-200">{offer.payoutSpeed}</dd></div>
              </dl>
              {offer.referralCode && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                  <span className="text-xs text-zinc-400">Referral code <strong className="ml-1 text-cyan-100">{offer.referralCode}</strong></span>
                  <button type="button" onClick={copyCode} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-white/15">
                    {copyStatus === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                    {copyStatus === 'copied' ? 'Copied' : 'Copy code'}
                  </button>
                  {copyStatus === 'error' && <p className="w-full text-xs text-rose-300">Could not copy. Select and copy the code instead.</p>}
                </div>
              )}
            </Disclosure>

            <Disclosure title="Terms & fine print">
              <p>{offer.honestTruth.theCatch}</p>
              <p className="mt-3 text-xs text-zinc-400">{offer.honestTruth.hiddenFeesWarning}</p>
              <dl className="mt-3 grid gap-2 border-t border-white/[0.08] pt-3 text-xs sm:grid-cols-2">
                <div><dt className="text-zinc-500">Minimum hold</dt><dd className="mt-0.5">{offer.honestTruth.minimumHoldTime}</dd></div>
                <div><dt className="text-zinc-500">ID verification</dt><dd className="mt-0.5">{offer.honestTruth.idVerificationRequired ? 'May be required' : 'Not required'}</dd></div>
              </dl>
            </Disclosure>

            <Disclosure title="Completed this offer?">
              <p className="text-xs text-zinc-400">This is self-reported and is not a verified conversion.</p>
              {completionStatus === 'submitted' ? (
                <p className="mt-3 text-emerald-300">Thanks — your report was recorded.</p>
              ) : (
                <button type="button" onClick={reportCompletion} disabled={completionStatus === 'submitting'} className="mt-3 rounded-md border border-emerald-300/30 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-60">
                  {completionStatus === 'submitting' ? 'Submitting...' : 'Report completion'}
                </button>
              )}
              {completionStatus === 'error' && <p className="mt-2 text-xs text-rose-300">Could not record the report. Please try again.</p>}
            </Disclosure>
          </div>
        </div>

        <div className="border-t border-white/[0.08] bg-[#0d1724] p-4">
          <button type="button" onClick={claim} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#06131a] hover:bg-cyan-200">
            Claim offer <ExternalLink className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-[10px] text-zinc-500">Confirm the latest terms on {offer.company}’s site.</p>
        </div>
      </div>
    </div>
  );
};
