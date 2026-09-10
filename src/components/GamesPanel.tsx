import React, { useMemo, useState } from 'react';
import { Gamepad2, RotateCcw, ShieldCheck } from 'lucide-react';

type Game = 'keno' | 'plinko' | 'cases' | 'mines' | 'blackjack';
const STARTING_CREDITS = 1000;

const cardValue = (card: number) => Math.min(card, 10);
const drawCard = () => Math.floor(Math.random() * 13) + 1;

export const GamesPanel: React.FC = () => {
  const [credits, setCredits] = useState(() => {
    const saved = localStorage.getItem('signups4fastcash_demo_credits');
    const parsed = saved ? Number(saved) : STARTING_CREDITS;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : STARTING_CREDITS;
  });
  const [game, setGame] = useState<Game>('keno');
  const [message, setMessage] = useState('Pick a game and play with demo credits.');
  const [kenoPick, setKenoPick] = useState<number[]>([]);
  const [kenoResult, setKenoResult] = useState<number[]>([]);
  const [plinkoResult, setPlinkoResult] = useState<number | null>(null);
  const [caseResult, setCaseResult] = useState<string | null>(null);
  const [mines, setMines] = useState<number[]>([]);
  const [revealedMines, setRevealedMines] = useState<number[]>([]);
  const [playerCards, setPlayerCards] = useState<number[]>([]);
  const [dealerCards, setDealerCards] = useState<number[]>([]);
  const [blackjackDone, setBlackjackDone] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('signups4fastcash_demo_credits', String(credits));
  }, [credits]);

  const mineSet = useMemo(() => new Set(mines), [mines]);
  const playerTotal = playerCards.reduce((sum, card) => sum + cardValue(card), 0);
  const dealerTotal = dealerCards.reduce((sum, card) => sum + cardValue(card), 0);

  const spend = (amount: number) => {
    if (credits < amount) {
      setMessage('You need more demo credits. Reset the demo balance to keep playing.');
      return false;
    }
    setCredits((value) => value - amount);
    return true;
  };

  const reset = () => {
    setCredits(STARTING_CREDITS);
    setMessage('Demo balance reset. These credits have no cash value.');
    setKenoPick([]);
    setKenoResult([]);
    setPlinkoResult(null);
    setCaseResult(null);
    setRevealedMines([]);
    setPlayerCards([]);
    setDealerCards([]);
    setBlackjackDone(false);
  };

  const playKeno = () => {
    if (!spend(10)) return;
    const result = Array.from({ length: 5 }, () => Math.floor(Math.random() * 20) + 1);
    const matches = kenoPick.filter((number) => result.includes(number));
    setKenoResult(result);
    if (matches.length >= 3) {
      const reward = matches.length * 15;
      setCredits((value) => value + reward);
      setMessage(`${matches.length} matches — you received ${reward} demo credits.`);
    } else setMessage(`${matches.length} matches. Try another demo round.`);
  };

  const playPlinko = () => {
    if (!spend(10)) return;
    const result = [0, 5, 10, 20, 50][Math.floor(Math.random() * 5)];
    setPlinkoResult(result);
    setCredits((value) => value + result);
    setMessage(`The demo ball landed on ${result} credits.`);
  };

  const openCase = () => {
    if (!spend(15)) return;
    const result = ['Common', 'Uncommon', 'Rare', 'Epic'][Math.floor(Math.random() * 4)];
    const rewards: Record<string, number> = { Common: 5, Uncommon: 20, Rare: 60, Epic: 150 };
    setCaseResult(result);
    setCredits((value) => value + rewards[result]);
    setMessage(`${result} case result — ${rewards[result]} demo credits returned.`);
  };

  const startMines = () => {
    if (!spend(10)) return;
    const positions = [...Array(25).keys()].sort(() => Math.random() - 0.5).slice(0, 5);
    setMines(positions);
    setRevealedMines([]);
    setMessage('Choose a tile. Demo mines reset when you start a new round.');
  };

  const revealMine = (position: number) => {
    if (!mines.length || revealedMines.includes(position)) return;
    setRevealedMines((value) => [...value, position]);
    if (mineSet.has(position)) setMessage('Demo mine! Start a new round to play again.');
    else {
      setCredits((value) => value + 5);
      setMessage('Safe tile — 5 demo credits added.');
    }
  };

  const startBlackjack = () => {
    if (!spend(10)) return;
    setPlayerCards([drawCard(), drawCard()]);
    setDealerCards([drawCard(), drawCard()]);
    setBlackjackDone(false);
    setMessage('Hit for another card or stand to finish the demo hand.');
  };

  const finishBlackjack = (cards = playerCards) => {
    if (!cards.length || blackjackDone) return;
    const total = cards.reduce((sum, card) => sum + cardValue(card), 0);
    const dealer = dealerTotal;
    setBlackjackDone(true);
    if (total <= 21 && (total > dealer || dealer > 21)) {
      setCredits((value) => value + 20);
      setMessage('You won the demo hand and received 20 demo credits.');
    } else if (total === dealer && total <= 21) {
      setCredits((value) => value + 10);
      setMessage('Demo push — your 10-credit entry was returned.');
    } else setMessage('Dealer wins this demo hand.');
  };

  const games: { id: Game; label: string }[] = [
    { id: 'keno', label: 'Keno' },
    { id: 'plinko', label: 'Plinko' },
    { id: 'cases', label: 'Cases' },
    { id: 'mines', label: 'Mines' },
    { id: 'blackjack', label: 'Blackjack' },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="games">
      <div className="rounded-xl border border-violet-400/20 bg-[#0e121a] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-400/10 p-2 text-violet-300"><Gamepad2 className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-violet-300">Entertainment zone</p>
              <h1 className="mt-1 text-xl font-bold text-white">Play with demo credits</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Keno, Plinko, Cases, Mines, and Blackjack are available for entertainment only.
                Demo credits are not money, cannot be purchased, and can never be exchanged for survey points or cash.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Demo credits</div>
              <div className="font-mono font-bold text-violet-200">{credits.toLocaleString()}</div>
            </div>
            <button onClick={reset} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white" title="Reset demo credits">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {games.map((item) => (
            <button key={item.id} onClick={() => setGame(item.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${game === item.id ? 'bg-violet-400 text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-white/[0.08] bg-black/10 p-4">
          {game === 'keno' && (
            <div>
              <h2 className="font-semibold text-white">Keno</h2>
              <p className="mt-1 text-xs text-zinc-500">Choose up to 5 numbers. Demo round cost: 10 credits.</p>
              <div className="mt-4 grid max-w-md grid-cols-10 gap-1.5">
                {Array.from({ length: 20 }, (_, index) => index + 1).map((number) => (
                  <button key={number} onClick={() => setKenoPick((value) => value.includes(number) ? value.filter((item) => item !== number) : value.length < 5 ? [...value, number] : value)} className={`rounded p-2 text-xs ${kenoPick.includes(number) ? 'bg-cyan-400 text-black' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}>
                    {number}
                  </button>
                ))}
              </div>
              <button onClick={playKeno} disabled={kenoPick.length === 0} className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Play Keno</button>
              {kenoResult.length > 0 && <p className="mt-3 text-xs text-cyan-300">Draw: {kenoResult.join(' · ')}</p>}
            </div>
          )}
          {game === 'plinko' && <GameAction title="Plinko" description="Drop a demo ball through the board. Demo round cost: 10 credits." action="Drop ball" onClick={playPlinko} result={plinkoResult === null ? null : `Landed on ${plinkoResult} demo credits.`} />}
          {game === 'cases' && <GameAction title="Cases" description="Open a random demo case. Demo case cost: 15 credits." action="Open case" onClick={openCase} result={caseResult ? `Case rarity: ${caseResult}` : null} />}
          {game === 'mines' && (
            <div>
              <h2 className="font-semibold text-white">Mines</h2>
              <p className="mt-1 text-xs text-zinc-500">Start a demo round, then reveal tiles. Safe reveals add 5 demo credits.</p>
              <button onClick={startMines} className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black">New Mines Round</button>
              <div className="mt-4 grid max-w-sm grid-cols-5 gap-1.5">
                {Array.from({ length: 25 }, (_, position) => <button key={position} onClick={() => revealMine(position)} className={`aspect-square rounded text-xs ${revealedMines.includes(position) ? (mineSet.has(position) ? 'bg-rose-500/70 text-white' : 'bg-emerald-500/50 text-white') : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}>{revealedMines.includes(position) ? (mineSet.has(position) ? '!' : '✓') : '?'}</button>)}
              </div>
            </div>
          )}
          {game === 'blackjack' && (
            <div>
              <h2 className="font-semibold text-white">Blackjack</h2>
              <p className="mt-1 text-xs text-zinc-500">Demo hand entry: 10 credits. Cards use simplified values for casual play.</p>
              <div className="mt-4 flex flex-wrap gap-6 text-sm text-zinc-300"><span>You: {playerCards.length ? playerCards.map(cardValue).join(' · ') : '—'} {playerCards.length ? `(${playerTotal})` : ''}</span><span>Dealer: {dealerCards.length ? dealerCards.map(cardValue).join(' · ') : '—'} {dealerCards.length ? `(${dealerTotal})` : ''}</span></div>
              <div className="mt-4 flex gap-2"><button onClick={startBlackjack} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black">New hand</button><button onClick={() => { const next = [...playerCards, drawCard()]; setPlayerCards(next); if (next.reduce((sum, card) => sum + cardValue(card), 0) > 21) finishBlackjack(next); }} disabled={!playerCards.length || blackjackDone} className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Hit</button><button onClick={() => finishBlackjack()} disabled={!playerCards.length || blackjackDone} className="rounded-lg bg-violet-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Stand</button></div>
            </div>
          )}
          <p className="mt-4 text-xs text-zinc-500">{message}</p>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Demo credits are separate from your survey balance. No wagering, deposits, cash prizes, or conversion to PayPal are available.</div>
      </div>
    </section>
  );
};

const GameAction: React.FC<{ title: string; description: string; action: string; onClick: () => void; result: string | null }> = ({ title, description, action, onClick, result }) => (
  <div>
    <h2 className="font-semibold text-white">{title}</h2>
    <p className="mt-1 text-xs text-zinc-500">{description}</p>
    <button onClick={onClick} className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black">{action}</button>
    {result && <p className="mt-3 text-xs text-violet-300">{result}</p>}
  </div>
);
