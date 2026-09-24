import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, X } from 'lucide-react';
import { Offer } from '../types';

interface OfferDetailsModalProps {
  offer: Offer;
  onClose: () => void;
  onClaimClick: (offerId: string) => void;
}

export const OfferDetailsModal: React.FC<OfferDetailsModalProps> = ({ offer, onClose, onClaimClick }) => {
  const [copied, setCopied] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const claimUrl = offer.referralUrl || offer.officialMerchantUrl;
  const copyCode = async () => {
    if (!offer.referralCode) return;
    await navigator.clipboard.writeText(offer.referralCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const claim = () => {
    onClaimClick(offer.id);
    const openedWindow = window.open(claimUrl, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(claimUrl);
  };
  const reportCompletion = async () => {
    setCompletionStatus('submitting');
    try {
      const response = await fetch(`/api/offers/${offer.id}/completion-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true }) });
      if (!response.ok) throw new Error('Could not submit completion report.');
      setCompletionStatus('submitted');
    } catch {
      setCompletionStatus('error');
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`offer-modal-title-${offer.id}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#0d1724] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-cyan-300">{offer.company}</p><h2 id={`offer-modal-title-${offer.id}`} className="truncate text-xl font-bold text-white">{offer.title}</h2></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close offer details"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-zinc-300">{offer.honestTruth.summary}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[['Reward', offer.incentiveAmount], ['Deposit', offer.depositRequired], ['Payout', offer.payoutSpeed], ['Effort', offer.difficulty]].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"><p className="text-[10px] uppercase text-zinc-500">{label}</p><p className="mt-1 text-xs font-semibold text-white">{value}</p></div>)}
          </div>
          {offer.referralCode && <div className="mt-4 flex items-center justify-between rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] p-3"><span className="text-xs text-zinc-400">Referral code <strong className="ml-2 text-cyan-100">{offer.referralCode}</strong></span><button type="button" onClick={copyCode} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white">{copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button></div>}
          <section className="mt-5"><h3 className="text-sm font-bold text-white">How to complete it</h3><ol className="mt-3 space-y-2">{offer.speedrunHints.map((hint) => <li key={hint.step} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-zinc-300"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-cyan-300/15 text-xs font-bold text-cyan-200">{hint.step}</span>{hint.instruction}{hint.proTip && <p className="mt-1 text-xs text-amber-200">Tip: {hint.proTip}</p>}</li>)}</ol></section>
          <section className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-amber-200"><AlertTriangle className="h-4 w-4" /> The honest truth</h3><p className="mt-2 text-sm leading-relaxed text-amber-100/80">{offer.honestTruth.theCatch}</p><p className="mt-3 text-xs text-amber-100/70">{offer.honestTruth.hiddenFeesWarning}</p><div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2"><span>Minimum hold: {offer.honestTruth.minimumHoldTime}</span><span>ID verification: {offer.honestTruth.idVerificationRequired ? 'May be required' : 'Not required'}</span></div></section>
          <button type="button" onClick={claim} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#06131a] hover:bg-cyan-200">Claim offer <ExternalLink className="h-4 w-4" /></button>
          <div className="mt-4 border-t border-white/[0.08] pt-4 text-xs text-zinc-400"><p>Completed this offer?</p>{completionStatus === 'submitted' ? <p className="mt-2 text-emerald-300">Thanks — your report was recorded.</p> : <button type="button" onClick={reportCompletion} disabled={completionStatus === 'submitting'} className="mt-2 rounded-md border border-emerald-300/30 px-3 py-2 text-emerald-200 hover:bg-emerald-300/10">{completionStatus === 'submitting' ? 'Submitting...' : 'Yes, I completed it'}</button>}{completionStatus === 'error' && <p className="mt-2 text-rose-300">Could not record the report. Please try again.</p>}</div>
        </div>
      </div>
    </div>
  );
};
