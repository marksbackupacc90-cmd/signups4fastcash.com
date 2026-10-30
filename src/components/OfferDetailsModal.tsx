import React, { useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, GitCompareArrows, X } from 'lucide-react';
import { Offer } from '../types';
import { getIdVerificationDescription, getOfferSourceUrl } from '../offerTransparency';
import { getCashoutSpotlightInfo } from '../cashoutSpotlight';

interface OfferDetailsModalProps {
  offer: Offer;
  onClose: () => void;
  onClaimClick: (offerId: string) => void;
  isCompared: boolean;
  onToggleCompare: (offerId: string) => void;
}

const Disclosure: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <details
    className="group rounded-xl border border-white/[0.08] bg-white/[0.025]"
    onToggle={(event) => {
      if (!event.currentTarget.open) return;
      event.currentTarget.parentElement?.querySelectorAll('details').forEach((item) => {
        if (item !== event.currentTarget) item.open = false;
      });
    }}
  >
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-200 marker:hidden">
      {title}
      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-white/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-300">
      {children}
    </div>
  </details>
);

export const OfferDetailsModal: React.FC<OfferDetailsModalProps> = ({ offer, onClose, onClaimClick, isCompared, onToggleCompare }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [issueType, setIssueType] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueReportStatus, setIssueReportStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const claimUrl = `/go/${encodeURIComponent(offer.id)}`;
  const sourceUrl = getOfferSourceUrl(offer);
  const cashoutSpotlight = getCashoutSpotlightInfo(offer.id);
  const isInterOffer = offer.id === 'offer-inter-loop-points';

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

  const reportOfferIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIssueReportStatus('submitting');
    try {
      const response = await fetch(`/api/offers/${encodeURIComponent(offer.id)}/issue-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: issueType, description: issueDescription }),
      });
      if (!response.ok) throw new Error('Could not submit offer issue report.');
      setIssueReportStatus('submitted');
    } catch {
      setIssueReportStatus('error');
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
            <p className="text-xs uppercase tracking-widest text-cyan-200">{offer.company}</p>
            <h2 id={`offer-modal-title-${offer.id}`} className="truncate text-lg font-bold text-white">{offer.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close offer details">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.08] pb-2">
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-cyan-100">
              View provider source <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              aria-controls="offer-issue-report"
              onClick={(event) => {
                const issueDetails = event.currentTarget.closest('[role="dialog"]')?.querySelector('#offer-issue-report');
                if (issueDetails instanceof HTMLDetailsElement) {
                  issueDetails.open = true;
                  issueDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  issueDetails.querySelector('summary')?.focus();
                }
              }}
              className="ml-3 inline-flex min-h-8 items-center text-xs font-semibold text-amber-200 hover:text-amber-100"
            >
              Report incorrect info
            </button>
          </div>
          {cashoutSpotlight && (
            <section className="mb-3 rounded-xl border border-violet-200/20 bg-violet-200/[0.06] p-3" aria-label="Cashout details">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-100">The Daily Duo</h3>
                <span className="rounded-full bg-black/20 px-2 py-1 text-xs font-semibold text-emerald-100">{cashoutSpotlight.payout}</span>
              </div>
              <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                <div><dt className="text-zinc-300">Verification</dt><dd className="mt-0.5 text-zinc-100">{cashoutSpotlight.verification}</dd></div>
                <div><dt className="text-zinc-300">Minimum</dt><dd className="mt-0.5 text-zinc-100">{cashoutSpotlight.minimum}</dd></div>
                {cashoutSpotlight.fee && <div className="sm:col-span-2"><dt className="text-zinc-300">Fee</dt><dd className="mt-0.5 text-zinc-100">{cashoutSpotlight.fee}</dd></div>}
              </dl>
              <p className="mt-2 border-t border-white/[0.07] pt-2 text-xs leading-relaxed text-amber-100">{cashoutSpotlight.caveat}</p>
            </section>
          )}
          {isInterOffer && (
            <section className="mb-3 rounded-xl border border-orange-200/25 bg-[radial-gradient(circle_at_0%_0%,rgba(251,146,60,0.14),transparent_60%),rgba(251,146,60,0.04)] p-4" aria-label="Inter Loop points reward">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-100">Featured referral reward</p>
              <p className="mt-1 text-3xl font-black leading-none text-orange-100">$25</p>
              <p className="mt-1 text-xs font-semibold text-orange-50">10,000 Loop points for each eligible participant</p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-200">Loop points are rewards points, not cash. The $25 estimate depends on Inter’s redemption terms, so check the current terms before signing up.</p>
            </section>
          )}
          <p className="text-sm leading-relaxed text-zinc-300">{offer.honestTruth.summary}</p>
          <div className="mt-4 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.05] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100">Advertised reward</p>
            <p className="mt-1 text-xl font-bold text-white">{offer.incentiveAmount}</p>
            <p className="mt-2 text-[13px] text-zinc-300">
              <span className="font-semibold text-zinc-300">Upfront requirement:</span> {offer.depositRequired}
            </p>
            <p className="mt-1 text-[13px] text-zinc-300">
              <span className="font-semibold text-zinc-300">Reward timing:</span> {offer.payoutSpeed}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleCompare(offer.id)}
            aria-pressed={isCompared}
            className={`mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              isCompared
                ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                : 'border-white/10 text-zinc-300 hover:border-cyan-300/30 hover:text-white'
            }`}
          >
            <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
            {isCompared ? 'Remove from comparison' : 'Add to comparison'}
          </button>
          {offer.referralCode && (
            <div className="mt-4 rounded-xl border border-amber-200/25 bg-amber-200/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-100">
                {offer.referralCodeRequired ? 'Required referral code' : 'Referral code'}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <strong className="font-mono text-lg tracking-wider text-white">{offer.referralCode}</strong>
                <button type="button" onClick={copyCode} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
                  {copyStatus === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  {copyStatus === 'copied' ? 'Copied' : 'Copy code'}
                </button>
              </div>
              {offer.referralCodeRequired && <p className="mt-2 text-[13px] leading-relaxed text-amber-50">Enter this code during signup to qualify for the referral reward.</p>}
              {copyStatus === 'error' && <p className="mt-2 text-xs text-rose-300">Could not copy. Select and copy the code instead.</p>}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <Disclosure title={`How to earn · ${offer.speedrunHints.length} steps`}>
              <ol className="space-y-3">
                {offer.speedrunHints.map((hint) => (
                  <li key={hint.step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-xs font-bold text-cyan-200">{hint.step}</span>
                    <div>
                      <p>{hint.instruction}</p>
                      {hint.proTip && <p className="mt-1 text-[13px] text-amber-100">Tip: {hint.proTip}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Disclosure>

            <Disclosure title="Requirements & payout details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <div><dt className="text-zinc-300">Signup setup estimate</dt><dd className="mt-0.5 text-zinc-100">{offer.difficulty}</dd></div>
                <div><dt className="text-zinc-300">Availability</dt><dd className="mt-0.5 text-zinc-100">{offer.availability}</dd></div>
                <div className="col-span-2"><dt className="text-zinc-300">Reward timing</dt><dd className="mt-0.5 text-zinc-100">{offer.payoutSpeed}</dd></div>
              </dl>
              <p className="mt-3 text-[13px] text-zinc-300">Setup time is an estimate for signing up only. Qualifying steps, provider review, and receiving a reward may take longer.</p>
            </Disclosure>

            <Disclosure title="Terms & fine print">
              <p>{offer.honestTruth.theCatch}</p>
              <p className="mt-3 text-[13px] text-zinc-300">{offer.honestTruth.hiddenFeesWarning}</p>
              <dl className="mt-3 grid gap-2 border-t border-white/[0.08] pt-3 text-xs sm:grid-cols-2">
                <div><dt className="text-zinc-500">Minimum hold</dt><dd className="mt-0.5">{offer.honestTruth.minimumHoldTime}</dd></div>
                <div><dt className="text-zinc-500">{cashoutSpotlight ? 'Identity check' : 'ID verification'}</dt><dd className="mt-0.5">{cashoutSpotlight?.verification || getIdVerificationDescription(offer.honestTruth.idVerificationRequired)}</dd></div>
              </dl>
            </Disclosure>

            <Disclosure title="Completed this offer?">
              <p className="text-[13px] text-zinc-300">This report comes from the member; it does not confirm that the provider paid a reward.</p>
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
          <a href={claimUrl} target="_blank" rel="noopener noreferrer" onClick={() => onClaimClick(offer.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#06131a] hover:bg-cyan-200">
            Continue to {offer.company} <ExternalLink className="h-4 w-4" />
          </a>
          <p className="mt-2 text-center text-xs leading-relaxed text-zinc-200">
            This may be a referral link. S4FC may earn a commission if you use it; it won’t cost you extra. {offer.company} decides eligibility, approval, reward value, and payment. Check its current terms before signing up.
          </p>
          <details id="offer-issue-report" className="mt-3 rounded-lg border border-white/[0.08]">
            <summary className="cursor-pointer px-3 py-2 text-center text-xs font-medium text-zinc-300 hover:text-white">
              Found an expired link or incorrect terms?
            </summary>
            <form onSubmit={reportOfferIssue} className="space-y-3 border-t border-white/[0.08] p-3">
              {issueReportStatus === 'submitted' ? (
                <p role="status" className="text-xs text-emerald-200">Thanks for letting us know. Your report was sent for review.</p>
              ) : (
                <>
                  <label className="block text-xs text-zinc-300">
                    What went wrong?
                    <select
                      required
                      value={issueType}
                      onChange={(event) => setIssueType(event.target.value)}
                      disabled={issueReportStatus === 'submitting'}
                      className="mt-1 w-full rounded-md border border-white/10 bg-[#111d2b] px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select an issue</option>
                      <option value="expired">Offer appears expired</option>
                      <option value="broken-link">Offer link is broken</option>
                      <option value="terms-wrong">Requirements or terms are incorrect</option>
                    </select>
                  </label>
                  <label className="block text-xs text-zinc-300">
                    Details (optional)
                    <textarea
                      value={issueDescription}
                      onChange={(event) => setIssueDescription(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      disabled={issueReportStatus === 'submitting'}
                      placeholder="Tell us what you saw on the provider's page."
                      className="mt-1 w-full resize-y rounded-md border border-white/10 bg-[#111d2b] px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    />
                    <span className="mt-1 block text-xs text-zinc-300">Do not include passwords or financial account details.</span>
                  </label>
                  {issueReportStatus === 'error' && (
                    <p role="alert" className="text-xs text-rose-300">Could not send your report. Please try again.</p>
                  )}
                  <button
                    type="submit"
                    disabled={issueReportStatus === 'submitting'}
                    className="rounded-md border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-60"
                  >
                    {issueReportStatus === 'submitting' ? 'Sending...' : 'Send report'}
                  </button>
                </>
              )}
            </form>
          </details>
        </div>
      </div>
    </div>
  );
};
