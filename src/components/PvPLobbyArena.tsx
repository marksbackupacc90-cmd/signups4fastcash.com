import React, { useEffect, useState } from 'react';
import { AlertCircle, CircleDollarSign, Clock3, Coins, LoaderCircle, RefreshCw, ShieldCheck, Swords } from 'lucide-react';

type RpsChoice = 'rock' | 'paper' | 'scissors';
type WagerCurrency = 'cash' | 'points';
type LobbyStateName = 'waiting' | 'active' | 'completed';

interface OpenLobby {
  id: string;
  player1Username: string;
  wagerAmount: number;
  currency: WagerCurrency;
  createdAt: string;
}

interface RpsLobbyState {
  lobby: {
    id: string;
    state: LobbyStateName;
    endedReason: 'settled' | 'expired' | null;
    wagerAmount: number;
    currency: WagerCurrency;
    createdAt: string;
  };
  yourChoice: RpsChoice | null;
  opponentMoveSubmitted: boolean;
  match?: {
    player1Choice: RpsChoice;
    player2Choice: RpsChoice;
    outcome: 'player1' | 'player2' | 'draw';
    poolAmount: number;
    rakeAmount: number;
  };
}

class ArenaRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ArenaRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChoice(value: unknown): value is RpsChoice {
  return value === 'rock' || value === 'paper' || value === 'scissors';
}

function isCurrency(value: unknown): value is WagerCurrency {
  return value === 'cash' || value === 'points';
}

async function requestApi(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'The arena request could not be completed.';
    throw new ArenaRequestError(message, response.status);
  }
  if (!isRecord(payload)) throw new Error('The arena returned an invalid response.');
  return payload;
}

function parseOpenLobby(value: unknown): OpenLobby | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.player1Username !== 'string'
    || typeof value.wagerAmount !== 'number'
    || !Number.isFinite(value.wagerAmount)
    || !isCurrency(value.currency)
    || typeof value.createdAt !== 'string') return null;
  return {
    id: value.id,
    player1Username: value.player1Username,
    wagerAmount: value.wagerAmount,
    currency: value.currency,
    createdAt: value.createdAt,
  };
}

function parseLobbyState(value: unknown): RpsLobbyState | null {
  if (!isRecord(value) || !isRecord(value.lobby)) return null;
  const lobby = value.lobby;
  if (typeof lobby.id !== 'string'
    || (lobby.state !== 'waiting' && lobby.state !== 'active' && lobby.state !== 'completed')
    || (lobby.endedReason !== null && lobby.endedReason !== 'settled' && lobby.endedReason !== 'expired')
    || typeof lobby.wagerAmount !== 'number'
    || !Number.isFinite(lobby.wagerAmount)
    || !isCurrency(lobby.currency)
    || typeof lobby.createdAt !== 'string'
    || (value.yourChoice !== null && !isChoice(value.yourChoice))
    || typeof value.opponentMoveSubmitted !== 'boolean') return null;

  let match: RpsLobbyState['match'];
  if (value.match !== undefined) {
    if (!isRecord(value.match)
      || !isChoice(value.match.player1Choice)
      || !isChoice(value.match.player2Choice)
      || (value.match.outcome !== 'player1' && value.match.outcome !== 'player2' && value.match.outcome !== 'draw')
      || typeof value.match.poolAmount !== 'number'
      || !Number.isFinite(value.match.poolAmount)
      || typeof value.match.rakeAmount !== 'number'
      || !Number.isFinite(value.match.rakeAmount)) return null;
    match = {
      player1Choice: value.match.player1Choice,
      player2Choice: value.match.player2Choice,
      outcome: value.match.outcome,
      poolAmount: value.match.poolAmount,
      rakeAmount: value.match.rakeAmount,
    };
  }

  return {
    lobby: {
      id: lobby.id,
      state: lobby.state,
      endedReason: lobby.endedReason === 'settled' || lobby.endedReason === 'expired' ? lobby.endedReason : null,
      wagerAmount: lobby.wagerAmount,
      currency: lobby.currency,
      createdAt: lobby.createdAt,
    },
    yourChoice: isChoice(value.yourChoice) ? value.yourChoice : null,
    opponentMoveSubmitted: value.opponentMoveSubmitted,
    ...(match ? { match } : {}),
  };
}

function maskUsername(username: string) {
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'Player';
  return parts.map((part) => `${part.slice(0, Math.min(2, part.length))}***`).join('_');
}

function formatWager(amount: number, currency: WagerCurrency) {
  return currency === 'cash'
    ? amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : `${amount.toLocaleString('en-US')} pts`;
}

const CHOICES: Array<{ value: RpsChoice; emoji: string }> = [
  { value: 'rock', emoji: '✊' },
  { value: 'paper', emoji: '✋' },
  { value: 'scissors', emoji: '✌️' },
];

interface PvPLobbyArenaProps {
  signedIn?: boolean;
  onSignIn?: () => void;
}

export const PvPLobbyArena: React.FC<PvPLobbyArenaProps> = ({ signedIn, onSignIn }) => {
  const [isSignedIn, setIsSignedIn] = useState(signedIn === true);
  const [authLoading, setAuthLoading] = useState(signedIn === undefined);
  const [currency, setCurrency] = useState<WagerCurrency>('cash');
  const [wagerAmount, setWagerAmount] = useState('0.50');
  const [lobbies, setLobbies] = useState<OpenLobby[]>([]);
  const [room, setRoom] = useState<RpsLobbyState | null>(null);
  const [loadingLobbies, setLoadingLobbies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLobbyId, setBusyLobbyId] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (signedIn !== undefined) {
      setIsSignedIn(signedIn);
      setAuthLoading(false);
      return;
    }

    let active = true;
    const loadAuth = async () => {
      try {
        const payload = await requestApi('/api/auth/me');
        if (!isRecord(payload) || !('user' in payload)) throw new Error('Could not verify the current account.');
        if (active) setIsSignedIn(payload.user !== null);
      } catch (authError) {
        if (active) {
          setIsSignedIn(false);
          setError(authError instanceof Error ? authError.message : 'Could not verify the current account.');
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void loadAuth();
    return () => { active = false; };
  }, [signedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setLobbies([]);
      setLoadingLobbies(false);
      return;
    }
    let active = true;
    let timer: number | undefined;
    const loadLobbies = async () => {
      setLoadingLobbies(true);
      try {
        const payload = await requestApi('/api/v1/rps/lobbies');
        if (!isRecord(payload) || !Array.isArray(payload.lobbies)) throw new Error('The open rooms response was invalid.');
        const nextLobbies: OpenLobby[] = [];
        for (const item of payload.lobbies) {
          const lobby = parseOpenLobby(item);
          if (!lobby) throw new Error('An open room had invalid data.');
          nextLobbies.push(lobby);
        }
        if (active) {
          setLobbies(nextLobbies);
          setError('');
        }
      } catch (requestError) {
        if (active) {
          if (requestError instanceof ArenaRequestError && requestError.status === 401) setIsSignedIn(false);
          setError(requestError instanceof Error ? requestError.message : 'Could not load open rooms.');
        }
      } finally {
        if (active) {
          setLoadingLobbies(false);
          timer = window.setTimeout(() => void loadLobbies(), 7_000);
        }
      }
    };
    void loadLobbies();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isSignedIn, refreshIndex]);

  useEffect(() => {
    const roomId = room?.lobby.id;
    const completed = room?.lobby.state === 'completed';
    if (!isSignedIn || !roomId || completed) return;
    let active = true;
    let timer: number | undefined;
    const pollRoom = async () => {
      try {
        const payload = await requestApi(`/api/v1/rps/lobbies/${encodeURIComponent(roomId)}`);
        const nextState = parseLobbyState(payload);
        if (!nextState) throw new Error('The match status response was invalid.');
        if (active) {
          setRoom(nextState);
          if (nextState.lobby.state === 'completed') {
            setNotice(nextState.lobby.endedReason === 'expired' ? 'This room expired.' : 'Match completed.');
            setError('');
          }
        }
      } catch (requestError) {
        if (active) {
          if (requestError instanceof ArenaRequestError && requestError.status === 401) setIsSignedIn(false);
          setError(requestError instanceof Error ? requestError.message : 'Could not refresh the match.');
        }
      } finally {
        if (active && !completed) timer = window.setTimeout(() => void pollRoom(), 2_000);
      }
    };
    void pollRoom();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isSignedIn, room?.lobby.id, room?.lobby.state]);

  const handleApiError = (requestError: unknown) => {
    if (requestError instanceof ArenaRequestError && requestError.status === 401) setIsSignedIn(false);
    setError(requestError instanceof Error ? requestError.message : 'The arena request could not be completed.');
  };

  const createLobby = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn || busy) return;
    const amount = Number(wagerAmount);
    if (!Number.isFinite(amount) || amount < (currency === 'cash' ? 0.5 : 50)) {
      setError(currency === 'cash' ? 'Cash wagers must be at least $0.50.' : 'Points wagers must be at least 50 points.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await requestApi('/api/v1/rps/lobbies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wagerAmount: amount, currency }),
      });
      if (!isRecord(payload) || !isRecord(payload.lobby)) throw new Error('The new room response was invalid.');
      const lobby = payload.lobby;
      if (typeof lobby.id !== 'string'
        || (lobby.state !== 'waiting' && lobby.state !== 'active' && lobby.state !== 'completed')
        || typeof lobby.wagerAmount !== 'number'
        || !isCurrency(lobby.currency)
        || typeof lobby.createdAt !== 'string') throw new Error('The new room response was invalid.');
      setRoom({
        lobby: {
          id: lobby.id,
          state: lobby.state,
          endedReason: null,
          wagerAmount: lobby.wagerAmount,
          currency: lobby.currency,
          createdAt: lobby.createdAt,
        },
        yourChoice: null,
        opponentMoveSubmitted: false,
      });
      setNotice('Room created. Waiting for another player to join.');
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const joinLobby = async (lobby: OpenLobby) => {
    if (!isSignedIn || busyLobbyId) return;
    setBusyLobbyId(lobby.id);
    setError('');
    setNotice('');
    try {
      const payload = await requestApi(`/api/v1/rps/lobbies/${encodeURIComponent(lobby.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wagerAmount: lobby.wagerAmount, currency: lobby.currency }),
      });
      const nextState = parseLobbyState(payload);
      if (!nextState) throw new Error('The joined room response was invalid.');
      setRoom(nextState);
      setNotice('You joined the room. Choose your move when ready.');
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusyLobbyId('');
    }
  };

  const submitMove = async (choice: RpsChoice) => {
    if (!room || room.lobby.state !== 'active' || room.yourChoice || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await requestApi(`/api/v1/rps/lobbies/${encodeURIComponent(room.lobby.id)}/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      const nextState = parseLobbyState(payload);
      if (!nextState) throw new Error('The move submission response was invalid.');
      setRoom(nextState);
      setNotice(nextState.lobby.state === 'completed'
        ? 'Both moves are revealed. The match is complete.'
        : 'Move locked. Your opponent cannot see it until both players have submitted.');
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const openSignIn = () => {
    if (onSignIn) onSignIn();
    else window.location.assign('/?auth=signin');
  };

  const currentResult = room?.match && room.yourChoice
    ? room.match.outcome === 'draw'
      ? 'draw'
      : room.match.outcome === (room.match.player1Choice === room.yourChoice ? 'player1' : 'player2')
        ? 'win'
        : 'loss'
    : null;

  return (
    <section className="space-y-5" aria-labelledby="pvp-arena-title">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            <Swords className="h-4 w-4" aria-hidden="true" /> Player vs. player
          </p>
          <h1 id="pvp-arena-title" className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">PvP Rock-Paper-Scissors</h1>
          <p className="mt-2 text-sm text-slate-400">Create a room or join a matching wager. Moves stay hidden until both players lock in.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2 text-xs font-medium text-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          Server-settled matches · 3% winner rake
        </div>
      </header>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-sm text-cyan-100">{notice}</p>}

      {authLoading ? (
        <div className="ui-card flex items-center gap-3 text-sm text-slate-300"><LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" aria-hidden="true" />Checking account access…</div>
      ) : !isSignedIn ? (
        <div className="ui-card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-white">Sign in to play</h2>
            <p className="mt-1 text-sm text-slate-400">Room creation, wagers, and match moves require an authenticated account.</p>
          </div>
          <button type="button" onClick={openSignIn} className="ui-button ui-button-primary">
            Sign in to enter arena
          </button>
        </div>
      ) : room ? (
        <section className="ui-card space-y-5" aria-labelledby="active-room-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Match room</p>
              <h2 id="active-room-title" className="mt-1 text-lg font-bold text-white">
                {room.lobby.state === 'waiting' ? 'Waiting for opponent' : room.lobby.state === 'active' ? 'Match in progress' : 'Match complete'}
              </h2>
              <p className="mt-1 text-sm text-slate-300">{formatWager(room.lobby.wagerAmount, room.lobby.currency)} wager · room {room.lobby.id.slice(0, 8)}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${room.lobby.state === 'completed' ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200' : 'border-violet-300/20 bg-violet-300/[0.08] text-violet-100'}`}>
              {room.lobby.state === 'completed' && room.lobby.endedReason === 'expired' ? 'Expired' : room.lobby.state}
            </span>
          </div>

          {room.lobby.state === 'waiting' && (
            <p className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4 text-sm text-slate-300">
              Your balance is checked again when someone joins; wagers are deducted once both players are ready. This room updates automatically.
            </p>
          )}

          {room.lobby.state === 'active' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Your move</p>
                  <p className="mt-2 text-sm text-slate-300">{room.yourChoice ? 'Locked and hidden from your opponent' : 'Choose one option below'}</p>
                </div>
                <div className="rounded-xl border border-violet-300/15 bg-violet-300/[0.04] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-200">Opponent move</p>
                  <p className="mt-2 text-sm text-slate-300">{room.opponentMoveSubmitted ? 'Move locked · choice concealed' : 'Waiting for opponent'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => void submitMove(choice.value)}
                    disabled={busy || Boolean(room.yourChoice)}
                    className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/45 text-white transition duration-200 hover:border-cyan-300/60 hover:bg-cyan-300/[0.08] hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-28"
                  >
                    <span className="text-4xl" aria-hidden="true">{choice.emoji}</span>
                    <span className="mt-2 text-xs font-bold capitalize">{choice.value}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {room.lobby.state === 'completed' && room.match && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Your move', choice: room.yourChoice },
                  { label: 'Opponent move', choice: room.yourChoice === room.match.player1Choice ? room.match.player2Choice : room.match.player1Choice },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-2 text-4xl" aria-label={item.choice || 'unknown'}>{CHOICES.find((choice) => choice.value === item.choice)?.emoji || '❔'}</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-white">{item.choice || 'Unknown'}</p>
                  </div>
                ))}
              </div>
              <div className={`rounded-xl border p-4 text-center ${currentResult === 'win' ? 'border-emerald-300/25 bg-emerald-300/[0.07]' : currentResult === 'loss' ? 'border-rose-300/20 bg-rose-300/[0.05]' : 'border-slate-700 bg-slate-950/45'}`}>
                <p className="text-lg font-extrabold capitalize text-white">{room.lobby.endedReason === 'expired' ? 'Room expired' : currentResult === 'win' ? 'Victory' : currentResult === 'loss' ? 'Defeat' : 'Draw'}</p>
                {room.lobby.endedReason !== 'expired' && <p className="mt-1 text-sm text-slate-300">Pool {formatWager(room.match.poolAmount, room.lobby.currency)} · rake {formatWager(room.match.rakeAmount, room.lobby.currency)}</p>}
              </div>
            </div>
          )}

          {room.lobby.state === 'completed' && !room.match && (
            <p className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4 text-sm text-slate-300">This room ended before a match was settled.</p>
          )}
          <button type="button" onClick={() => { setRoom(null); setNotice('Returned to the open rooms.'); }} className="ui-button ui-button-secondary">
            Back to open rooms
          </button>
        </section>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <form onSubmit={(event) => void createLobby(event)} className="ui-card space-y-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-200"><Coins className="h-4 w-4" aria-hidden="true" /> Match creation</p>
              <h2 className="mt-2 text-lg font-bold text-white">Set your wager</h2>
            </div>
            <label className="form-field">
              <span className="form-label">Wager currency</span>
              <select
                value={currency}
                onChange={(event) => {
                  const nextCurrency = event.target.value === 'points' ? 'points' : 'cash';
                  setCurrency(nextCurrency);
                  setWagerAmount(nextCurrency === 'cash' ? '0.50' : '50');
                }}
              >
                <option value="cash">Cash balance</option>
                <option value="points">Points balance</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Wager amount</span>
              <span className="relative">
                {currency === 'cash' ? <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /> : <Coins className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />}
                <input
                  type="number"
                  required
                  min={currency === 'cash' ? '0.50' : '50'}
                  step={currency === 'cash' ? '0.01' : '1'}
                  value={wagerAmount}
                  onChange={(event) => setWagerAmount(event.target.value)}
                  className="w-full !pl-10"
                  aria-describedby="rps-wager-hint"
                />
              </span>
              <span id="rps-wager-hint" className="field-hint">Minimum: {currency === 'cash' ? '$0.50' : '50 points'}. Both players must have enough balance.</span>
            </label>
            <button type="submit" disabled={busy} className="ui-button ui-button-primary w-full">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Swords className="h-4 w-4" aria-hidden="true" />}
              {busy ? 'Creating room…' : 'Create Match'}
            </button>
            <p className="text-xs leading-5 text-slate-500">The server verifies and reserves each player’s wager. Winners receive the pool after the disclosed 3% rake; draws refund both entries.</p>
          </form>

          <section className="ui-card" aria-labelledby="open-lobbies-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Matchmaking</p>
                <h2 id="open-lobbies-title" className="mt-1 text-lg font-bold text-white">Open lobbies</h2>
              </div>
              <button type="button" onClick={() => setRefreshIndex((index) => index + 1)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200" aria-label="Refresh open lobbies">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLobbies ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
              </button>
            </div>
            {loadingLobbies && lobbies.length === 0 ? (
              <p className="flex items-center gap-2 py-8 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />Loading open rooms…</p>
            ) : lobbies.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No open rooms right now. Create a match to start one.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {lobbies.map((lobby) => (
                  <li key={lobby.id} className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Hosted by</p>
                        <p className="mt-1 truncate text-sm font-bold text-white">{maskUsername(lobby.player1Username)}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1 text-xs font-bold tabular-nums text-cyan-100">{formatWager(lobby.wagerAmount, lobby.currency)}</span>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Open for a match</p>
                    <button type="button" onClick={() => void joinLobby(lobby)} disabled={busyLobbyId !== ''} className="ui-button ui-button-secondary mt-4 w-full text-xs">
                      {busyLobbyId === lobby.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                      {busyLobbyId === lobby.id ? 'Joining…' : 'Enter Match'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
};
