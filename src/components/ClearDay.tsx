import React, { useState } from 'react';
import { CalendarClock, CheckCircle2, Copy, FileSearch, Loader2, Send, ShieldAlert } from 'lucide-react';

interface ClearDayResult {
  summary: string;
  urgency: 'low' | 'medium' | 'high';
  actionItems: Array<{ action: string; deadline: string; reason: string }>;
  moneyImpact: string;
  replyDraft: string;
}

const SAMPLE = `Your internet provider notice:
Starting October 1, your monthly price will increase by $15.
You can cancel without an early termination fee until September 30.
Call 1-800-555-0100 or reply to this email if you have questions.`;

export const ClearDay: React.FC = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ClearDayResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyze = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/life-admin/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json() as { result?: ClearDayResult; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error || 'Analysis failed.');
      setResult(data.result);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Could not analyze that content.');
    } finally {
      setBusy(false);
    }
  };

  const copyDraft = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.replyDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="retro-window" aria-labelledby="clearday-title">
      <div className="retro-titlebar flex items-center justify-between text-xs">
        <span id="clearday-title" className="flex items-center gap-2"><FileSearch className="h-4 w-4" /> ClearDay / Life Admin</span>
        <span className="text-cyan-200">PRIVATE BY DESIGN</span>
      </div>
      <div className="p-4 sm:p-6">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">Turn confusing into clear</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Paste a bill, notice, or email. Get your next move.</h2>
          <p className="mt-2 text-sm text-slate-300">ClearDay finds deadlines, money impact, and practical next steps. It never sends anything without your approval.</p>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a bill, renewal notice, or important email here..."
          className="retro-inset mt-5 min-h-32 w-full resize-y p-3 text-sm outline-none focus:border-cyan-300"
          maxLength={12000}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="retro-button flex items-center gap-2 font-bold" onClick={analyze} disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'Reading...' : 'Find my next moves'}
          </button>
          <button className="text-xs text-cyan-300 underline" onClick={() => setText(SAMPLE)}>Try a sample</button>
          <span className="text-xs text-slate-400">Do not paste passwords, SSNs, or full account numbers.</span>
        </div>
        {error && <p className="mt-4 border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        {result && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="retro-inset p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-bold">Your action plan</h3>
                <span className={`font-mono text-xs uppercase ${result.urgency === 'high' ? 'text-red-300' : result.urgency === 'medium' ? 'text-amber-300' : 'text-emerald-300'}`}>{result.urgency} priority</span>
              </div>
              <p className="mt-3 text-sm">{result.summary}</p>
              <div className="mt-4 space-y-3">
                {result.actionItems.map((item, index) => (
                  <div key={`${item.action}-${index}`} className="flex gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <div><strong>{item.action}</strong><p className="text-xs text-slate-300">{item.deadline} · {item.reason}</p></div>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-300"><strong>Money impact:</strong> {result.moneyImpact}</p>
            </div>
            <div className="retro-inset p-4">
              <h3 className="flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4 text-cyan-300" /> Approval-ready reply</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.replyDraft}</p>
              <button className="retro-button mt-4 flex items-center gap-2 text-xs" onClick={copyDraft}><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy draft'}</button>
            </div>
          </div>
        )}
        <div className="mt-5 flex items-start gap-2 text-xs text-slate-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          AI can miss context. Verify dates, amounts, and terms with the original sender before acting.
        </div>
      </div>
    </section>
  );
};
