import { useEffect, useState } from 'react';
import type { Offer } from '../types';

function getOfferSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts.length === 2 && parts[0] === 'offers'
    ? decodeURIComponent(parts[1]).toLowerCase()
    : '';
}

export function OfferLandingPage() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch('/api/offers')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load offers');
        return response.json();
      })
      .then((data: { offers: Offer[] }) => {
        if (!active) return;

        const slug = getOfferSlug();
        const eligibleOffers = (data.offers || []).filter(
          (item) =>
            item.status === 'live' &&
            String(item.category) !== 'surveys'
            && (item.verificationStatus === 'reviewed' || item.verificationStatus === 'terms-vary')
        );

        const matches = eligibleOffers.filter(
          (item) => item.companySlug.toLowerCase() === slug
        );

        setOffer(matches.length === 1 ? matches[0] : null);
      })
      .catch(() => {
        if (active) setOffer(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!offer) return;

    const title = `${offer.company} Signup Offer: ${offer.incentiveAmount} | S4FC`;
    const description =
      `${offer.title}. Review the reward, requirements, payout timing, ` +
      `and important terms before signing up.`;

    document.title = title;

    let meta = document.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }

    meta.content = description;
  }, [offer]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080c13] px-5 py-20 text-center text-white">
        Loading offer details...
      </main>
    );
  }

  if (!offer) {
    return (
      <main className="min-h-screen bg-[#080c13] px-5 py-20 text-center text-white">
        <div className="mx-auto max-w-xl">
          <h1 className="text-3xl font-bold">Offer Not Available</h1>
          <p className="mt-4 text-zinc-400">
            This offer may have expired, been removed, or may no longer be
            available. Please check our current offers.
          </p>
          <a
            href="/"
            className="mt-8 inline-flex rounded-lg bg-cyan-300 px-6 py-3 font-bold text-[#06131a]"
          >
            Browse Available Offers
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080c13] px-5 py-12 text-white sm:py-20">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
          ← Back to all offers
        </a>

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#111722] p-6 shadow-xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            Signup offer
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            {offer.company}
          </h1>

          <p className="mt-3 text-lg text-zinc-300">{offer.title}</p>

          <div className="mt-8 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <p className="text-sm text-zinc-400">Advertised reward</p>
            <p className="mt-2 text-4xl font-extrabold text-cyan-300">
              {offer.incentiveAmount}
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Deposit required</p>
              <p className="mt-1 font-semibold">{offer.depositRequired}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Payout timing</p>
              <p className="mt-1 font-semibold">{offer.payoutSpeed}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Difficulty</p>
              <p className="mt-1 font-semibold">{offer.difficulty}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Availability</p>
              <p className="mt-1 font-semibold">{offer.availability}</p>
            </div>
          </div>

          <section className="mt-9 border-t border-white/10 pt-7">
            <h2 className="text-xl font-bold">How this offer works</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              {offer.honestTruth.summary}
            </p>
          </section>

          <section className="mt-7">
            <h2 className="text-xl font-bold">Important things to know</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              {offer.honestTruth.theCatch}
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
              <li>
                <strong className="text-white">Minimum hold time:</strong>{' '}
                {offer.honestTruth.minimumHoldTime}
              </li>
              <li>
                <strong className="text-white">ID verification:</strong>{' '}
                {offer.honestTruth.idVerificationRequired ? 'Required' : 'Not listed as required'}
              </li>
              <li>
                <strong className="text-white">Fees:</strong>{' '}
                {offer.honestTruth.hiddenFeesWarning}
              </li>
            </ul>
          </section>

          {offer.referralCode && (
            <section className="mt-7 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-zinc-400">Referral code</p>
              <p className="mt-1 text-lg font-bold">{offer.referralCode}</p>
            </section>
          )}

          <a
            href={`/go/${encodeURIComponent(offer.id)}`}
            className="mt-9 flex min-h-14 items-center justify-center rounded-xl bg-cyan-300 px-6 py-4 text-center font-extrabold text-[#06131a] transition hover:bg-cyan-200"
          >
            View Offer &amp; Sign Up
          </a>

          <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
            Offer terms, eligibility, and rewards can change. Review the
            provider's official terms before signing up. Rewards are not guaranteed.
          </p>
        </div>
      </article>
    </main>
  );
}
