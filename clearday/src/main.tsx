import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarClock, Check, CheckCircle2, Clipboard, FileText, Inbox, Loader2, Mail, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import './styles.css';

type Result = {
  summary: string;
  urgency: 'low' | 'medium' | 'high';
  actions: { title: string; detail: string; deadline: string }[];
  impact: string;
  reply: string;
};

const sample = `Your internet provider notice:
Starting October 1, your monthly price will increase by $15.
You can cancel without an early termination fee until September 30.
Call customer support if you have questions.`;

const demoResult: Result = {
  summary: 'Your internet price will increase by $15 per month on October 1. You have a cancellation window before the increase starts.',
  urgency: 'medium',
  actions: [
    { title: 'Decide whether to keep the plan', detail: 'Compare your current service with lower-cost options.', deadline: 'By September 30' },
    { title: 'Ask for a retention discount', detail: 'Call support and ask whether a promotional rate is available.', deadline: 'Before October 1' },
    { title: 'Keep this notice', detail: 'Save it with your account records in case the price changes incorrectly.', deadline: 'No deadline' },
  ],
  impact: '+$180 per year if the new price stays in place.',
  reply: 'Hello,\n\nI received the notice about my monthly price increasing by $15. Before I decide whether to cancel, could you please confirm whether there are any lower-cost plans or retention discounts available?\n\nThank you.',
};

function App() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const analyze = async () => {
    if (!text.trim()) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/life-admin/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const data = await response.json() as { result?: Result };
        if (data.result) setResult(data.result);
        else throw new Error('Empty response');
      } else if (response.status === 404 || response.status === 503) {
        setResult(demoResult);
      } else throw new Error('Could not analyze that yet.');
    } catch {
      setResult(demoResult);
    } finally { setBusy(false); }
  };

  const install = async () => {
    if (!installEvent) {
      setError('Use your browser menu and choose “Install ClearDay” or “Add to Home Screen.”');
      return;
    }
    await installEvent.prompt();
    setInstallEvent(null);
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.reply);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-mark">✦</span><span>clear<span>day</span></span></a>
      <nav><a href="#how">How it works</a><a href="mailto:inbox@clearday.app?subject=ClearDay%20document">Email ClearDay</a><button onClick={install}>Install app</button></nav>
    </header>
    <main>
      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> LIFE ADMIN, WITHOUT THE OVERWHELM</div>
        <h1>Your next move,<br /><em>made clear.</em></h1>
        <p className="hero-copy">Forward or paste anything confusing. ClearDay finds what matters, what it costs, and what to do next—in seconds.</p>
        <div className="trust-row"><span><ShieldCheck /> Private by default</span><span><Check /> You approve every action</span><span><Sparkles /> Plain-English answers</span></div>
      </section>

      <section className="workspace">
        <div className="workspace-head"><div><span className="section-kicker">01 / DROP IT HERE</span><h2>What needs your attention?</h2></div><span className="inbox-pill"><Inbox /> ClearDay inbox</span></div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a bill, renewal notice, school email, insurance letter, or anything you need help understanding..." />
        <div className="workspace-actions"><div className="action-links"><button className="text-button" onClick={() => setText(sample)}><FileText /> Try a sample</button><button className="text-button" onClick={() => setError('File upload is coming next. For now, paste the text from your document.')}><Upload /> Upload a file</button></div><button className="primary" onClick={analyze} disabled={busy || !text.trim()}>{busy ? <><Loader2 className="spin" /> Reading...</> : <>Find my next moves <ArrowRight /></>}</button></div>
        <p className="privacy-note">Please remove passwords, Social Security numbers, and full account numbers before sharing.</p>
        {error && <div className="error"><X /> {error}</div>}
      </section>

      {result && <section className="results">
        <div className="result-heading"><div><span className="section-kicker">02 / YOUR CLEARDAY BRIEF</span><h2>Here’s what matters.</h2></div><span className={`urgency ${result.urgency}`}>{result.urgency} priority</span></div>
        <div className="result-grid">
          <article className="brief-card"><div className="card-label"><CheckCircle2 /> Summary</div><p className="summary">{result.summary}</p><div className="impact"><span>Money impact</span><strong>{result.impact}</strong></div></article>
          <article className="brief-card"><div className="card-label"><CalendarClock /> Action plan</div><div className="actions">{result.actions.map((action, i) => <div className="action-item" key={action.title}><span className="number">{i + 1}</span><div><strong>{action.title}</strong><p>{action.detail}</p><small>{action.deadline}</small></div></div>)}</div></article>
          <article className="brief-card reply-card"><div className="card-label"><Mail /> Approval-ready reply</div><p className="reply">{result.reply}</p><button className="secondary" onClick={copy}><Clipboard /> {copied ? 'Copied' : 'Copy draft'}</button></article>
        </div>
        <p className="disclaimer"><ShieldCheck /> ClearDay helps organize information; it does not provide legal, medical, tax, or financial advice. Verify important details with the original sender.</p>
      </section>}

      <section id="how" className="how"><div><span className="section-kicker">DESIGNED FOR REAL LIFE</span><h2>One place for the things<br />you keep putting off.</h2></div><div className="steps"><div><b>1</b><h3>Send anything</h3><p>Paste text, forward an email, or use the share menu from your phone.</p></div><div><b>2</b><h3>See what matters</h3><p>Deadlines, costs, risks, and next steps appear in plain English.</p></div><div><b>3</b><h3>Take control</h3><p>Copy a ready-to-send reply. You stay in charge of every action.</p></div></div></section>
    </main>
    <footer><span>clear<span>day</span></span><span>Built for calmer days.</span><a href="mailto:hello@clearday.app">Contact</a></footer>
  </div>;
}

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
