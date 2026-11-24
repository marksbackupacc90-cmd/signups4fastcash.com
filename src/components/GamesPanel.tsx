import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, ShieldCheck, Swords } from 'lucide-react';
import { PvPLobbyArena } from './PvPLobbyArena';

type RpsChoice = 'rock' | 'paper' | 'scissors';
type RpsOutcome = 'win' | 'loss' | 'draw';

interface RpsGameResponse {
  gameId: string;
  choice: RpsChoice;
  opponent: { username: string; choice: RpsChoice };
  outcome: RpsOutcome;
  entryBet: number;
  payout: number;
  balancePoints: number;
  balanceDollars: number;
  error?: string;
}

interface GamesPanelProps {
  signedIn: boolean;
  onSignIn: () => void;
}

const HANDS: Record<RpsChoice, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};

const CHOICES: RpsChoice[] = ['rock', 'paper', 'scissors'];

export const GamesPanel: React.FC<GamesPanelProps> = ({ signedIn, onSignIn }) => {
  const [mode, setMode] = useState<'pvp' | 'quick'>('pvp');
  const [selectedChoice, setSelectedChoice] = useState<RpsChoice>('rock');
  const [opponentChoice, setOpponentChoice] = useState<RpsChoice>('rock');
  const [opponentName, setOpponentName] = useState('Finding opponent...');
  const [outcome, setOutcome] = useState<RpsOutcome | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [message, setMessage] = useState('Choose your move. Win the $1.00 pot.');
  const lookupTimerRef = useRef<number | null>(null);
  const [history, setHistory] = useState<{ choice: RpsChoice; opponent: RpsChoice; outcome: RpsOutcome }[]>([]);

  useEffect(() => () => {
    if (lookupTimerRef.current !== null) window.clearTimeout(lookupTimerRef.current);
  }, []);

  const play = async (choice: RpsChoice) => {
    if (matching) return;
    if (!signedIn) {
      onSignIn();
      return;
    }

    setSelectedChoice(choice);
    setOutcome(null);
    setMatching(true);
    setOpponentName('Finding opponent...');
    setMessage('Matchmaking...');

    const idempotencyKey = globalThis.crypto?.randomUUID?.()
      ?? `rps-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const response = await fetch('/api/games/rps/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ choice, entryBet: 0.5 }),
      });
      const data = await response.json().catch(() => ({ error: 'Could not process the game.' })) as RpsGameResponse;
      if (!response.ok) {
        if (response.status === 401) onSignIn();
        throw new Error(data.error || 'Could not process the game.');
      }

      let handIndex = 0;
      lookupTimerRef.current = window.setInterval(() => {
        setOpponentChoice(CHOICES[handIndex % CHOICES.length]);
        handIndex += 1;
      }, 160);
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      window.clearInterval(lookupTimerRef.current);
      lookupTimerRef.current = null;

      setOpponentChoice(data.opponent.choice);
      setOpponentName(data.opponent.username);
      setOutcome(data.outcome);
      setBalance(data.balanceDollars);
      setHistory((items) => [{ choice: data.choice, opponent: data.opponent.choice, outcome: data.outcome }, ...items].slice(0, 5));
      setMessage(
        data.outcome === 'win'
          ? `You won $${data.payout.toFixed(2)}!`
          : data.outcome === 'draw'
            ? 'Draw — your $0.50 entry was returned.'
            : 'Opponent wins this round.',
      );
    } catch (error) {
      setOpponentName('Match cancelled');
      setMessage(error instanceof Error ? error.message : 'Could not process the game.');
    } finally {
      setMatching(false);
    }
  };

  const outcomeLabel = outcome === 'win' ? 'Victory' : outcome === 'draw' ? 'Draw' : outcome === 'loss' ? 'Defeat' : 'Ready';

  return (
    <section className="mx-auto min-h-[calc(100vh-64px)] max-w-5xl px-4 py-8 sm:px-6" id="games">
      <div className="mb-5 inline-flex rounded-xl border border-slate-700 bg-slate-900/80 p-1" role="group" aria-label="Choose a Rock-Paper-Scissors mode">
        <button type="button" onClick={() => setMode('pvp')} aria-pressed={mode === 'pvp'} className={`min-h-10 rounded-lg px-4 text-sm font-bold transition ${mode === 'pvp' ? 'bg-violet-300/15 text-violet-100' : 'text-slate-400 hover:text-white'}`}>PvP Arena</button>
        <button type="button" onClick={() => setMode('quick')} aria-pressed={mode === 'quick'} className={`min-h-10 rounded-lg px-4 text-sm font-bold transition ${mode === 'quick' ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-400 hover:text-white'}`}>Quick Play</button>
      </div>
      {mode === 'pvp' ? (
        <PvPLobbyArena signedIn={signedIn} onSignIn={onSignIn} />
      ) : (
      <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            <Swords className="h-4 w-4" aria-hidden="true" /> Live PvP arena
          </div>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Rock. Paper. Scissors.</h1>
          <p className="mt-2 text-sm text-zinc-400">$0.50 entry · $1.00 win pot</p>
        </div>
        {balance !== null && (
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-right">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-cyan-200/70">Wallet</span>
            <span className="text-lg font-black tabular-nums text-white">${balance.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-3xl border border-white/10 bg-[#0e121a] p-4 shadow-2xl sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center sm:gap-8">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">You</p>
              <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full border bg-white/[0.04] text-7xl sm:h-40 sm:w-40 ${matching ? 'rps-lookup-hand border-cyan-300/30' : 'border-white/10'}`}>
                {HANDS[selectedChoice]}
              </div>
            </div>
            <div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${outcome === 'win' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : outcome === 'loss' ? 'border-rose-300/30 bg-rose-300/10 text-rose-200' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}>
                {outcomeLabel}
              </span>
            </div>
            <div>
              <p className="mb-3 truncate text-xs font-bold uppercase tracking-widest text-zinc-500">{opponentName}</p>
              <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full border bg-white/[0.04] text-7xl sm:h-40 sm:w-40 ${matching ? 'rps-lookup-hand border-violet-300/30' : 'border-white/10'}`}>
                {HANDS[opponentChoice]}
              </div>
            </div>
          </div>

          <p className="mt-5 min-h-6 text-center text-sm font-semibold text-cyan-100" aria-live="polite">{message}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => void play(choice)}
                disabled={matching}
                className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-24 ${
                  selectedChoice === choice ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]'
                }`}
              >
                <span className="text-3xl sm:text-4xl">{HANDS[choice]}</span>
                <span className="mt-1 text-xs font-bold capitalize">{choice}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0e121a] p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white"><RotateCcw className="h-4 w-4 text-cyan-300" /> Match history</h2>
            {history.length > 0 ? (
              <div className="mt-3 space-y-2">
                {history.map((item, index) => (
                  <div key={`${item.choice}-${item.opponent}-${index}`} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs">
                    <span>{HANDS[item.choice]} <span className="text-zinc-500">vs</span> {HANDS[item.opponent]}</span>
                    <span className={item.outcome === 'win' ? 'font-bold text-emerald-300' : item.outcome === 'loss' ? 'text-rose-300' : 'text-zinc-300'}>
                      {item.outcome}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">Your recent matches will appear here.</p>
            )}
          </div>
          <div className="flex gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4 text-xs leading-relaxed text-emerald-100/75">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            Match fees and payouts are stored in the wallet ledger. Duplicate replay requests are protected by idempotency.
          </div>
        </aside>
      </div>
      </section>
      )}
    </section>
  );
};
