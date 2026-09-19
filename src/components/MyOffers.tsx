import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Flag, RotateCcw, X } from 'lucide-react';
import { Offer } from '../types';

export type MyOfferStatus = 'active' | 'completed' | 'issue';

interface MyOfferEntry {
  offerId: string;
  status: MyOfferStatus;
  updatedAt: string;
}

interface MyOffersProps {
  offers: Offer[];
  trackedOfferIds: string[];
  open: boolean;
  onClose: () => void;
  onResume: (offer: Offer) => void;
  onStatusChange: (offerId: string, status: MyOfferStatus) => void;
  onReportIssue: (offerId: string) => void;
}

const STORAGE_KEY = 'signups4fastcash_my_offers';

export function readMyOfferEntries(): MyOfferEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as MyOfferEntry[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.offerId === 'string') : [];
  } catch {
    return [];
  }
}

export const MyOffers: React.FC<MyOffersProps> = ({
  offers,
  trackedOfferIds,
  open,
  onClose,
  onResume,
  onStatusChange,
  onReportIssue,
}) => {
  const [entries, setEntries] = useState<MyOfferEntry[]>(readMyOfferEntries);
  const trackedOffers = useMemo(
    () => trackedOfferIds.map((id) => offers.find((offer) => offer.id === id)).filter((offer): offer is Offer => Boolean(offer)),
    [offers, trackedOfferIds],
  );

  useEffect(() => {
    const handleStorage = () => setEntries(readMyOfferEntries());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    setEntries(readMyOfferEntries());
  }, [trackedOfferIds.join('|')]);

  const updateStatus = (offerId: string, status: MyOfferStatus) => {
    const next = entries.map((entry) => entry.offerId === offerId
      ? { ...entry, status, updatedAt: new Date().toISOString() }
      : entry);
    setEntries(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    onStatusChange(offerId, status);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="my-offers-title" className="mx-auto max-w-2xl rounded-2xl border border-cyan-300/25 bg-[#0c1017] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Saved offers</p>
                <h2 id="my-offers-title" className="mt-1 text-2xl font-bold text-white">My Offers</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">Resume an offer, confirm that you completed it, or tell us when something went wrong.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close My Offers"><X className="h-4 w-4" /></button>
            </div>

            {trackedOffers.length === 0 ? (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-sm font-semibold text-white">No saved offers yet</p>
                <p className="mt-1 text-xs text-zinc-400">Click any offer’s Open or Claim button and it will appear here for easy access later.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {trackedOffers.map((offer) => {
                  const entry = entries.find((item) => item.offerId === offer.id);
                  const status = entry?.status || 'active';
                  return (
                    <div key={offer.id} className="rounded-xl border border-white/10 bg-[#141824] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">{offer.company}</p>
                          <h3 className="mt-1 text-sm font-bold text-white">{offer.title}</h3>
                          <p className="mt-1 text-xs text-zinc-300">{offer.incentiveAmount} · {status === 'completed' ? 'Marked completed' : status === 'issue' ? 'Issue reported' : 'In progress'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status === 'completed' ? 'bg-emerald-400/15 text-emerald-300' : status === 'issue' ? 'bg-amber-400/15 text-amber-200' : 'bg-cyan-400/15 text-cyan-200'}`}>
                          {status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onResume(offer)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-[#071016] hover:bg-cyan-200">
                          <ExternalLink className="h-3.5 w-3.5" /> Resume offer
                        </button>
                        {status !== 'completed' && (
                          <button type="button" onClick={() => updateStatus(offer.id, 'completed')} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/30 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/10">
                            <CheckCircle2 className="h-3.5 w-3.5" /> I completed it
                          </button>
                        )}
                        {status !== 'issue' && (
                          <button type="button" onClick={() => { updateStatus(offer.id, 'issue'); onReportIssue(offer.id); }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-300/10">
                            <Flag className="h-3.5 w-3.5" /> Report an issue
                          </button>
                        )}
                        {status !== 'active' && (
                          <button type="button" onClick={() => updateStatus(offer.id, 'active')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">
                            <RotateCcw className="h-3.5 w-3.5" /> Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-5 text-xs leading-relaxed text-zinc-300">Signed-in offers sync to your account. If you are browsing as a guest, saved offers stay on this device.</p>
          </section>
        </div>
      )}
    </>
  );
};
