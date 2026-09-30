import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { Offer } from '../types';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface ComparisonDialogProps {
  offers: Offer[];
  onRemove: (offerId: string) => void;
  onClose: () => void;
}

const rows: { label: string; value: (offer: Offer) => string }[] = [
  { label: 'Advertised reward', value: (offer) => offer.incentiveAmount },
  { label: 'Requirement', value: (offer) => offer.depositRequired },
  { label: 'Payout timing', value: (offer) => offer.payoutSpeed },
  { label: 'Effort', value: (offer) => offer.difficulty },
  { label: 'Eligibility', value: (offer) => offer.availability },
  { label: 'Minimum hold', value: (offer) => offer.honestTruth.minimumHoldTime },
  { label: 'Fees and fine print', value: (offer) => offer.honestTruth.hiddenFeesWarning },
];

export const ComparisonDialog: React.FC<ComparisonDialogProps> = ({ offers, onRemove, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(dialogRef, onClose);

  return (
  <div ref={dialogRef} className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="offer-comparison-title">
    <section className="light-dialog w-full max-w-6xl overflow-hidden rounded-t-2xl border sm:rounded-2xl">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">Side-by-side</p>
          <h2 id="offer-comparison-title" className="mt-1 text-xl font-bold text-slate-900">Compare offers</h2>
          <p className="mt-1 text-xs text-slate-600">Compare the terms that differ. Providers make the final eligibility and payout decisions.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close comparison">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="max-h-[75vh] overflow-auto p-4 sm:p-6">
        <div className="grid gap-3 sm:hidden">
          {offers.map((offer) => (
            <article key={offer.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{offer.company}</p>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">{offer.title}</h3>
                  <p className="mt-2 text-xl font-extrabold text-emerald-800">{offer.incentiveAmount}</p>
                </div>
                <button type="button" onClick={() => onRemove(offer.id)} className="text-xs font-semibold text-slate-500 underline underline-offset-2" aria-label={`Remove ${offer.company} from comparison`}>Remove</button>
              </div>
              <dl className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs">
                {rows.slice(1).map(({ label, value }) => (
                  <div key={label}>
                    <dt className="font-semibold text-slate-500">{label}</dt>
                    <dd className="mt-0.5 leading-relaxed text-slate-800">{value(offer)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>

        <table className="hidden w-full min-w-[720px] border-collapse text-left text-sm sm:table">
          <thead>
            <tr>
              <th scope="col" className="w-40 border-b border-slate-200 p-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Offer details</th>
              {offers.map((offer) => (
                <th scope="col" key={offer.id} className="border-b border-slate-200 p-3 align-top">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{offer.company}</p>
                      <p className="mt-1 font-bold text-slate-900">{offer.title}</p>
                    </div>
                    <button type="button" onClick={() => onRemove(offer.id)} className="text-xs font-semibold text-slate-500 underline underline-offset-2" aria-label={`Remove ${offer.company} from comparison`}>Remove</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, value }, index) => (
              <tr key={label} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                <th scope="row" className="border-b border-slate-100 p-3 align-top text-xs font-semibold text-slate-600">{label}</th>
                {offers.map((offer) => (
                  <td key={offer.id} className={`border-b border-slate-100 p-3 align-top leading-relaxed ${index === 0 ? 'font-bold text-emerald-900' : 'text-slate-700'}`}>
                    {value(offer)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600 sm:px-6">
        No offer is best for everyone. Check official provider terms, fees, deadlines, and eligibility before applying.
      </p>
    </section>
  </div>
  );
};
