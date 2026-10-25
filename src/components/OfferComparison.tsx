import React from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';
import { getOfferReviewDateLabel, getOfferSourceUrl } from '../offerTransparency';

interface OfferComparisonProps {
  offers: Offer[];
  onClose: () => void;
  onRemove: (offerId: string) => void;
  onViewOffer: (offerId: string) => void;
}

const rows: { label: string; value: (offer: Offer) => string }[] = [
  { label: 'Reward', value: (offer) => offer.incentiveAmount },
  { label: 'Deposit or purchase', value: (offer) => offer.depositRequired },
  { label: 'ID verification', value: (offer) => offer.honestTruth.idVerificationRequired ? 'Required' : 'Not listed as required' },
  { label: 'Signup estimate', value: (offer) => offer.difficulty },
  { label: 'Reward timing', value: (offer) => offer.payoutSpeed },
  { label: 'Availability', value: (offer) => offer.availability },
  { label: 'Review status', value: (offer) => offer.verificationStatus === 'reviewed' ? 'Reviewed' : offer.verificationStatus === 'terms-vary' ? 'Terms vary' : 'Not independently verified' },
  { label: 'Review date', value: (offer) => getOfferReviewDateLabel(offer) },
  { label: 'Important conditions', value: (offer) => offer.honestTruth.theCatch },
];

export const OfferComparison: React.FC<OfferComparisonProps> = ({ offers, onClose, onRemove, onViewOffer }) => (
  <div
    className="fixed inset-0 z-[75] overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-labelledby="offer-comparison-title"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section className="mx-auto my-3 max-w-6xl overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#0c1017] shadow-2xl sm:my-8">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Side-by-side</p>
          <h2 id="offer-comparison-title" className="mt-1 text-xl font-bold text-white sm:text-2xl">Compare offers</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">Compare requirements and reported rewards. Providers control eligibility and final terms.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close offer comparison" className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-left">
          <thead>
            <tr className="bg-white/[0.025]">
              <th scope="col" className="w-44 p-3 text-xs font-semibold text-zinc-400 sm:w-52 sm:p-4">What to compare</th>
              {offers.map((offer) => (
                <th key={offer.id} scope="col" className="border-l border-white/[0.08] p-3 align-top sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="sm" className="!h-9 !w-9 rounded-lg bg-white/[0.06] p-1" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-zinc-400">{offer.company}</p>
                        <p className="line-clamp-2 text-sm font-bold text-white">{offer.title}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => onRemove(offer.id)} aria-label={`Remove ${offer.company} from comparison`} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, value }) => (
              <tr key={label} className="border-t border-white/[0.08] align-top">
                <th scope="row" className="p-3 text-xs font-semibold text-zinc-300 sm:p-4">{label}</th>
                {offers.map((offer) => (
                  <td key={offer.id} className="border-l border-white/[0.08] p-3 text-xs leading-relaxed text-zinc-300 sm:p-4">
                    {value(offer)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-white/[0.08]">
              <th scope="row" className="p-3 text-xs font-semibold text-zinc-300 sm:p-4">Next step</th>
              {offers.map((offer) => (
                <td key={offer.id} className="border-l border-white/[0.08] p-3 sm:p-4">
                  <div className="flex flex-col items-start gap-2">
                    <button type="button" onClick={() => onViewOffer(offer.id)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-[#06131a] hover:bg-cyan-200">
                      View offer <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <a href={getOfferSourceUrl(offer)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center text-[11px] text-cyan-200 hover:text-cyan-100">
                      Provider source
                    </a>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-white/[0.08] px-4 py-3 text-[11px] leading-relaxed text-zinc-500">
        Reward values and requirements can change. A listed reward is not guaranteed; confirm current terms with the provider before applying.
      </p>
    </section>
  </div>
);
