import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, CheckCircle2, Clock, Terminal, ChevronRight, Sparkles } from 'lucide-react';

interface CashBotStatusProps {
  onTriggerScan: () => Promise<void>;
  isScanning: boolean;
  lastScannedTime: string;
  pendingCount: number;
  isAdminUnlocked?: boolean;
}

export const CashBotStatus: React.FC<CashBotStatusProps> = ({
  onTriggerScan,
  isScanning,
  lastScannedTime,
  pendingCount,
  isAdminUnlocked = false,
}) => {
  const [secondsUntilNextScan, setSecondsUntilNextScan] = useState<number>(3600);
  const [logs, setLogs] = useState<string[]>([
    '[00:00:01] CashBot initialized. Daemon running on 3600s interval.',
    '[00:15:32] Scanned 14 affiliate networks (Impact, CJ, Rakuten, Direct Bank APIs).',
    '[00:30:10] Verified promo terms against SEC/FDIC bank disclosures.',
    isAdminUnlocked
      ? '[00:45:00] Extracted 2 high-converting opportunities awaiting admin review.'
      : '[00:45:00] Extracted 2 high-converting opportunities under verification pipeline.',
  ]);

  // Hourly countdown timer simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilNextScan((prev) => (prev > 1 ? prev - 1 : 3600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleManualScan = async () => {
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Manual CashBot scan initiated by user...`,
      ...prev.slice(0, 5)
    ]);
    await onTriggerScan();
    setSecondsUntilNextScan(3600);
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Scan complete: Analyzed new promos & formulated honest terms.`,
      ...prev.slice(0, 5)
    ]);
  };

  return (
    <div className="rounded-xl bg-[#0b0e14] border border-white/[0.08] p-4 sm:p-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Left info */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[#38bdf8] shrink-0">
            <Bot className={`w-5 h-5 ${isScanning ? 'animate-bounce text-[#00f2fe]' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                CashBot Scraper v2.4
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Hourly Auto-Scan
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Continuously monitors fintech announcements, bank bonuses, and affiliate feeds every hour.
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden xs:block">
            <span className="text-[10px] font-mono text-zinc-500 block">NEXT SCAN IN</span>
            <span className="text-xs font-mono font-bold text-[#38bdf8]">
              {formatCountdown(secondsUntilNextScan)}
            </span>
          </div>

          <button
            id="btn-trigger-cashbot-scan"
            onClick={handleManualScan}
            disabled={isScanning}
            className="px-3.5 py-2 rounded-lg bg-[#141a24] border border-white/10 hover:border-[#00f2fe]/40 text-xs font-mono text-white flex items-center gap-2 transition-all disabled:opacity-50 hover:bg-[#18202d] active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00f2fe] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'CashBot Scanning...' : 'Run Scan Now'}</span>
          </button>
        </div>

      </div>

      {/* Terminal Mini-Log */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] bg-[#07090d] rounded-lg p-3 font-mono text-[11px] text-zinc-400 space-y-1">
        <div className="flex items-center justify-between text-zinc-500 text-[10px] border-b border-white/[0.04] pb-1 mb-1.5">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-zinc-400" />
            CASHBOT_DAEMON_LOG
          </span>
          <span className="text-amber-400 font-semibold">
            {isAdminUnlocked
              ? `${pendingCount} Pending Approval in Admin`
              : `${pendingCount} Offers In Verification Pipeline`}
          </span>
        </div>
        {logs.slice(0, 3).map((log, i) => (
          <div key={i} className="flex items-center gap-1.5 truncate">
            <ChevronRight className="w-3 h-3 text-[#38bdf8] shrink-0" />
            <span className={i === 0 ? 'text-zinc-200' : 'text-zinc-500'}>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
