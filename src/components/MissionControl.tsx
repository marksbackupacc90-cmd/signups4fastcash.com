import React, { useMemo, useState } from 'react';
import { ArrowRight, Flag, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
import { Offer } from '../types';

interface MissionControlProps {
  offers: Offer[];
  onSelectOffer: (offerId: string) => void;
}

function dollars(value: string) {
  const match = value.match(/\$(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function minutes(value: Offer['difficulty']) {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 10;
}

export const MissionControl: React.FC<MissionControlProps> = ({ offers, onSelectOffer }) => {
  const [goal, setGoal] = useState(50);
  const [timeLimit, setTimeLimit] = useState(60);
  const [depositLimit, setDepositLimit] = useState(20);
  const [launched, setLaunched] = useState(false);

  const route = useMemo(() => {
    const eligible = offers
      .filter((offer) => dollars(offer.depositRequired) <= depositLimit)
      .sort((a, b) => b.incentiveValue - a.incentiveValue);
    const selected: Offer[] = [];
    let totalTime = 0;
    let totalValue = 0;
    for (const offer of eligible) {
      const offerTime = minutes(offer.difficulty);
      if (totalTime + offerTime > timeLimit) continue;
      selected.push(offer);
      totalTime += offerTime;
      totalValue += offer.incentiveValue;
      if (totalValue >= goal) break;
    }
    return { selected, totalTime, totalValue };
  }, [depositLimit, goal, offers, timeLimit]);

  return (
    <section className="retro-window mt-6" aria-labelledby="mission-control-title">
      <div className="retro-titlebar flex items-center justify-between text-xs">
        <span id="mission-control-title" className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5" /> CashOS Mission Control
        </span>
        <span aria-hidden="true">RUN_ROUTE.EXE</span>
      </div>
      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(240px,0.8fr)_1.2fr]">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-cyan-300">
            <Sparkles className="h-4 w-4" /> Build your money route
          </div>
          <h2 className="mt-2 text-2xl font-black">What are you optimizing for?</h2>
          <p className="mt-2 text-sm leading-relaxed">
            CashOS builds a transparent plan from the live catalog. No hype: every step shows the reward, time, deposit, and catch.
          </p>

          <div className="mt-5 space-y-4 text-xs">
            <label className="block font-bold">
              GOAL: <span className="font-mono">${goal}</span>
              <input className="mt-1 block w-full" type="range" min="10" max="300" step="10" value={goal} onChange={(event) => setGoal(Number(event.target.value))} />
            </label>
            <label className="block font-bold">
              TIME AVAILABLE: <span className="font-mono">{timeLimit} minutes</span>
              <input className="mt-1 block w-full" type="range" min="15" max="180" step="15" value={timeLimit} onChange={(event) => setTimeLimit(Number(event.target.value))} />
            </label>
            <label className="block font-bold">
              MAX DEPOSIT: <span className="font-mono">${depositLimit}</span>
              <input className="mt-1 block w-full" type="range" min="0" max="100" step="5" value={depositLimit} onChange={(event) => setDepositLimit(Number(event.target.value))} />
            </label>
          </div>
          <button className="retro-button mt-5 flex items-center gap-2 font-bold" onClick={() => setLaunched(true)}>
            <Gauge className="h-4 w-4" /> {launched ? 'Route recalculated' : 'Launch route'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="retro-inset p-3 sm:p-4">
          <div className="flex items-center justify-between border-b border-gray-400 pb-2 font-mono text-xs font-bold">
            <span>RECOMMENDED_ROUTE.LOG</span>
            <span className="text-emerald-300">{route.totalValue >= goal ? 'TARGET REACHABLE' : 'BEST AVAILABLE'}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div><strong className="block text-lg">${route.totalValue}</strong><span>estimated value</span></div>
            <div><strong className="block text-lg">{route.totalTime}m</strong><span>active time</span></div>
            <div><strong className="block text-lg">{route.selected.length}</strong><span>checkpoints</span></div>
          </div>
          <div className="mt-4 space-y-2">
            {route.selected.length === 0 && <p className="p-3 text-sm">No route fits those constraints. Increase your time or deposit limit.</p>}
            {route.selected.map((offer, index) => (
              <button key={offer.id} onClick={() => onSelectOffer(offer.id)} className="retro-button flex w-full items-center gap-3 text-left">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-400 font-mono font-bold text-slate-950">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{offer.company}</strong>
                  <span className="block truncate text-xs">{offer.incentiveAmount} · {offer.difficulty} · {offer.depositRequired}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 border-t border-gray-400 pt-3 text-[11px]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>Estimates use listed offer values. Merchant eligibility and final payout terms always control.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
