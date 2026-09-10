import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export const SurveyRewardsPanel: React.FC = () => (
  <SurveyPanelContent />
);

const SurveyPanelContent: React.FC = () => {
  const [surveyUrl, setSurveyUrl] = useState<string | null>(null);
  const [surveyUnavailable, setSurveyUnavailable] = useState(false);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const storageKey = 'signups4fastcash_survey_user_id';
    const existing = localStorage.getItem(storageKey);
    const userId = existing || `web-${crypto.randomUUID()}`;
    if (!existing) localStorage.setItem(storageKey, userId);
    fetch(`/api/cpx/balance?user_id=${encodeURIComponent(userId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { points?: number } | null) => {
        if (data?.points !== undefined) setPoints(data.points);
      })
      .catch(() => undefined);
    fetch(`/api/cpx/survey-url?user_id=${encodeURIComponent(userId)}`)
      .then(async (response) => {
        if (!response.ok) {
          setSurveyUnavailable(true);
          return;
        }
        const data = await response.json() as { enabled?: boolean; url?: string };
        if (data.enabled && data.url) setSurveyUrl(data.url);
        else setSurveyUnavailable(true);
      })
      .catch(() => setSurveyUnavailable(true));
  }, []);

  return (
  <section className="rounded-xl border border-cyan-400/20 bg-[#0e121a] p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Surveys &amp; Rewards</p>
        <h2 className="mt-1 text-xl font-bold text-white">Earn only through approved survey partners</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Surveys are provided by CPX Research. Availability, eligibility, completion decisions, rewards,
          and payout timing are controlled by the provider. We do not promise earnings or instant payouts.
        </p>
      </div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {[
        ['Clear requirements', 'See eligibility, estimated time, and provider terms before starting.'],
        ['Provider handles rewards', 'Payouts and survey decisions remain subject to the provider’s rules.'],
        ['No guaranteed income', 'Survey inventory, rates, reversals, and eligibility can change.'],
      ].map(([title, text]) => (
        <div key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <h3 className="text-xs font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{text}</p>
        </div>
      ))}
    </div>
    <div className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
      <p className="text-xs font-mono uppercase tracking-wider text-emerald-300">Your survey rewards</p>
      <p className="mt-1 text-lg font-bold text-white">{points.toLocaleString()} points <span className="text-sm font-normal text-zinc-400">(${(points / 100).toFixed(2)})</span></p>
      <p className="mt-1 text-xs text-zinc-400">100 points = $1. PayPal cash-out minimum: $5.00. Payout requests are not enabled until account verification and payout processing are completed.</p>
    </div>
    <a
      href="#trust"
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
    >
      Review how offers work
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
    {surveyUrl ? (
      <iframe
        title="CPX Research surveys"
        src={surveyUrl}
        className="mt-6 h-[680px] w-full rounded-lg border border-white/[0.08] bg-white sm:h-[760px] lg:h-[820px]"
        loading="lazy"
      />
    ) : (
      <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-200">
        {surveyUnavailable
          ? 'The survey wall is not configured yet. Please check back after the provider integration is enabled.'
          : 'Checking survey availability…'}
      </div>
    )}
  </section>
  );
};
