import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, History, Info, RotateCcw, ShieldCheck, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';

type SymbolId = 'crown' | 'gem' | 'moon' | 'star' | 'bolt' | 'seven' | 'wild';
type Cell = { id: SymbolId; icon: string; label: string; tone: string };

const STARTING_CREDITS = 1000;
const BETS = [5, 10, 25, 50, 100];
const REEL_COUNT = 5;
const ROW_COUNT = 4;

const SYMBOLS: Record<SymbolId, Cell> = {
  crown: { id: 'crown', icon: '♛', label: 'Crown', tone: 'text-amber-200' },
  gem: { id: 'gem', icon: '◆', label: 'Gem', tone: 'text-fuchsia-300' },
  moon: { id: 'moon', icon: '☾', label: 'Moon', tone: 'text-cyan-200' },
  star: { id: 'star', icon: '✦', label: 'Star', tone: 'text-violet-200' },
  bolt: { id: 'bolt', icon: 'ϟ', label: 'Bolt', tone: 'text-yellow-200' },
  seven: { id: 'seven', icon: '7', label: 'Seven', tone: 'text-rose-300' },
  wild: { id: 'wild', icon: 'W', label: 'Wild', tone: 'text-white' },
};

const SYMBOL_IDS: SymbolId[] = ['crown', 'gem', 'moon', 'star', 'bolt', 'seven', 'wild'];
const PAYOUTS: Record<SymbolId, number> = { crown: 8, gem: 12, moon: 18, star: 26, bolt: 40, seven: 75, wild: 150 };
const PAYLINES = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3],
];

const randomCell = (): Cell => SYMBOLS[SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]];
const makeGrid = (): Cell[][] => Array.from({ length: REEL_COUNT }, () => Array.from({ length: ROW_COUNT }, randomCell));

const getWin = (grid: Cell[][], bet: number) => {
  const wins = PAYLINES.map((line, lineIndex) => {
    const cells = line.map((row, reel) => grid[reel][row]);
    const first = cells[0].id === 'wild' ? cells.find((cell) => cell.id !== 'wild')?.id ?? 'wild' : cells[0].id;
    const matches = cells.filter((cell) => cell.id === first || cell.id === 'wild').length;
    return matches >= 3 ? { line: lineIndex, symbol: first, amount: Math.round(bet * (PAYOUTS[first] / 10) * (matches / 3)) } : null;
  }).filter(Boolean) as { line: number; symbol: SymbolId; amount: number }[];
  const wilds = grid.flat().filter((cell) => cell.id === 'wild').length;
  return { wins, total: wins.reduce((sum, win) => sum + win.amount, 0), wilds };
};

export const GamesPanel: React.FC = () => {
  const [credits, setCredits] = useState(() => {
    const saved = localStorage.getItem('signups4fastcash_demo_credits');
    const parsed = saved ? Number(saved) : STARTING_CREDITS;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : STARTING_CREDITS;
  });
  const [bet, setBet] = useState(10);
  const [grid, setGrid] = useState<Cell[][]>(() => makeGrid());
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(true);
  const [message, setMessage] = useState('Set your bet, then spin the reels.');
  const [lastWin, setLastWin] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [activeLines, setActiveLines] = useState<number[]>([]);
  const [freeSpins, setFreeSpins] = useState(0);

  useEffect(() => {
    localStorage.setItem('signups4fastcash_demo_credits', String(credits));
  }, [credits]);

  const currentMultiplier = useMemo(() => (lastWin > 0 ? lastWin / bet : 0), [lastWin, bet]);

  const reset = () => {
    setCredits(STARTING_CREDITS);
    setGrid(makeGrid());
    setHistory([]);
    setLastWin(0);
    setActiveLines([]);
    setFreeSpins(0);
    setMessage('Demo balance reset. These credits have no cash value.');
  };

  const spin = () => {
    if (spinning) return;
    const isFreeSpin = freeSpins > 0;
    if (!isFreeSpin && credits < bet) {
      setMessage('Not enough demo credits. Reset the demo balance to keep playing.');
      return;
    }
    if (isFreeSpin) setFreeSpins((value) => value - 1);
    else setCredits((value) => value - bet);
    setLastWin(0);
    setActiveLines([]);
    setSpinning(true);
    setMessage('The Mirage is spinning...');
    window.setTimeout(() => {
      const nextGrid = makeGrid();
      const result = getWin(nextGrid, bet);
      setGrid(nextGrid);
      setCredits((value) => value + result.total);
      if (result.wilds > 0) {
        setFreeSpins((value) => value + result.wilds);
      }
      setLastWin(result.total);
      setActiveLines(result.wins.map((win) => win.line));
      setHistory((value) => [result.total, ...value].slice(0, 5));
      setSpinning(false);
      if (result.wilds > 0) {
        setMessage(`${result.wilds} wild${result.wilds === 1 ? '' : 's'} found — ${result.wilds} free spin${result.wilds === 1 ? '' : 's'} added.`);
      } else if (isFreeSpin) {
        setMessage(result.total ? `Free spin hit — ${result.total.toLocaleString()} demo credits landed.` : 'The wild chain ended. Spin again to start a new feature.');
      } else {
        setMessage(result.total ? `Beautiful hit — ${result.total.toLocaleString()} demo credits landed.` : 'No line hit this time. The next spin is yours.');
      }
    }, turbo ? 500 : 1200);
  };

  return (
    <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8" id="games">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(124,58,237,0.2),transparent_42%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-300">
              <Sparkles className="h-3.5 w-3.5" /> After-hours arcade
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">
              Neon <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">Mirage</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">A five-reel, three-row demo slot with cascading light, wild symbols, and three hand-tuned paylines.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] px-4 py-2.5 text-right shadow-[0_0_30px_rgba(139,92,246,0.1)]">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-200/60">Demo credits</div>
              <div className="mt-0.5 text-xl font-black tabular-nums text-violet-100">{credits.toLocaleString()}</div>
            </div>
            <button onClick={reset} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-zinc-400 transition hover:border-white/20 hover:text-white" title="Reset demo credits">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[2rem] border border-violet-300/20 bg-[#11101d]/90 p-3 shadow-[0_25px_100px_rgba(76,29,149,0.22)] sm:p-5">
            <div className="flex items-center justify-between px-2 pb-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live demo</div>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"><span>RTP 96.4%</span><span className="hidden text-emerald-300 sm:inline">Fair play mode</span></div>
            </div>

            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#080711] p-2 shadow-inner shadow-black/80 sm:p-4">
              <div className="absolute inset-x-0 top-1/2 z-10 h-20 -translate-y-1/2 border-y border-fuchsia-300/30 bg-gradient-to-r from-fuchsia-400/[0.04] via-violet-300/[0.1] to-fuchsia-400/[0.04] pointer-events-none" />
              <div className="relative grid grid-cols-5 gap-1.5 sm:gap-3">
                {grid.map((reel, reelIndex) => (
                  <div key={reelIndex} className={`grid gap-1.5 sm:gap-3 ${spinning ? 'slot-reel-spinning' : ''}`} style={{ animationDelay: `${reelIndex * 90}ms` }}>
                    {reel.map((cell, rowIndex) => (
                      <div key={`${reelIndex}-${rowIndex}`} className={`relative flex aspect-[0.82] items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.015] ${activeLines.includes(rowIndex) ? 'border-fuchsia-300/70 shadow-[0_0_22px_rgba(232,121,249,0.35)]' : ''}`}>
                        <span className={`slot-symbol select-none text-4xl font-black drop-shadow-[0_0_16px_currentColor] sm:text-6xl ${cell.tone} ${cell.id === 'wild' ? 'italic' : ''}`}>{cell.icon}</span>
                        {cell.id === 'wild' && <span className="absolute bottom-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/60">Wild</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-20 flex -translate-y-1/2 justify-between">
                <span className="h-0 w-0 border-y-[9px] border-l-0 border-r-[13px] border-y-transparent border-r-fuchsia-300 drop-shadow-[0_0_8px_#f0abfc]" />
                <span className="h-0 w-0 border-y-[9px] border-r-0 border-l-[13px] border-y-transparent border-l-fuchsia-300 drop-shadow-[0_0_8px_#f0abfc]" />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bet</span>
                <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
                  {BETS.map((value) => <button key={value} onClick={() => setBet(value)} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${bet === value ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>{value}</button>)}
                </div>
                {freeSpins > 0 && <span className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-200">{freeSpins} free spin{freeSpins === 1 ? '' : 's'}</span>}
              </div>
              <button onClick={spin} disabled={spinning} className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 px-8 py-3 text-sm font-black text-black shadow-[0_0_25px_rgba(217,70,239,0.3)] transition hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(217,70,239,0.5)] disabled:cursor-not-allowed disabled:opacity-50">
                <Zap className="h-4 w-4 fill-current" /> {spinning ? 'Spinning...' : 'Spin the Mirage'}
              </button>
            </div>
            <div className="mt-3 flex min-h-6 items-center justify-center gap-2 text-center text-xs text-zinc-400">
              {lastWin > 0 && <span className="font-bold text-emerald-300">+{lastWin.toLocaleString()} · {currentMultiplier.toFixed(1)}x</span>}
              <span>{message}</span>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#11101d]/80 p-4">
              <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Gauge className="h-4 w-4 text-cyan-300" /> Console</h2><button onClick={() => setSound((value) => !value)} className="text-zinc-500 hover:text-white">{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>
              <button onClick={() => setTurbo((value) => !value)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${turbo ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-zinc-400'}`}><span>Turbo reels</span><span className="text-[10px] uppercase tracking-widest">{turbo ? 'On' : 'Off'}</span></button>
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>Bet per spin</span><span className="font-bold text-white">{bet} credits</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300" style={{ width: `${Math.min(100, (bet / 100) * 100)}%` }} /></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#11101d]/80 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><History className="h-4 w-4 text-violet-300" /> Recent hits</h2>
              {history.length ? <div className="space-y-2">{history.map((win, index) => <div key={`${win}-${index}`} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs"><span className="text-zinc-500">Spin {history.length - index}</span><span className={win ? 'font-bold text-emerald-300' : 'text-zinc-500'}>{win ? `+${win}` : '—'}</span></div>)}</div> : <p className="text-xs leading-relaxed text-zinc-500">Your last five spin results will appear here.</p>}
            </div>
          </aside>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#11101d]/70 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400">Paylines</h2>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-zinc-500 sm:grid-cols-4"><span className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/5 p-2 text-center text-fuchsia-200">Row 1<br />x3+</span><span className="rounded-lg border border-violet-300/20 bg-violet-300/5 p-2 text-center text-violet-200">Row 2<br />x3+</span><span className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-2 text-center text-cyan-200">Row 3<br />x3+</span><span className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-2 text-center text-amber-200">Row 4<br />x3+</span></div>
          </div>
          <div className="flex items-start gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-xs leading-relaxed text-amber-100/70"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" /><span><strong className="text-amber-100">Demo mode only.</strong> Wilds trigger free spins, and every wild in the chain adds another free spin. Credits have no cash value, cannot be purchased, and never connect to survey points or payouts.</span><Info className="mt-0.5 ml-auto h-4 w-4 shrink-0 text-amber-200/70" /></div>
        </div>
      </div>
    </section>
  );
};
