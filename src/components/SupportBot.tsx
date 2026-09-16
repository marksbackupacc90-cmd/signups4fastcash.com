import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { SfcCoinLogo } from './SfcCoinLogo';

interface SupportMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const SupportBot: React.FC = () => {
  const [conversationId] = useState(() => {
    const key = 's4fc_support_conversation';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  });
  const [open, setOpen] = useState(false);
  const supportMenuRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([
    { role: 'assistant', content: 'Hi! I can help you compare offers, understand requirements, and find the right place to start.' },
  ]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (supportMenuRef.current && !supportMenuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [open]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const response = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'The support assistant is unavailable.');
      setMessages((current) => [...current, { role: 'assistant', content: data.answer || 'I could not find an answer. Please review the offer details and official terms.' }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'The support assistant is unavailable right now.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={supportMenuRef} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <section className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#8bd3a7]/25 bg-[#14251f] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0e121a] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#f1e6cf]">
              <MessageCircle className="h-4 w-4 text-[#8bd3a7]" />
              S4FC Support
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-[#f1e6cf]" aria-label="Close support chat">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto bg-[#141824] p-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'ml-6 bg-[#6eae89] text-[#102018]' : 'mr-6 bg-[#0e121a] text-zinc-200'}`}>
                {message.content}
              </div>
            ))}
            {loading && <div className="mr-6 rounded-lg bg-[#0e121a] px-3 py-2 text-xs text-zinc-400">Thinking...</div>}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/[0.08] bg-[#0e121a] p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about an offer..."
              maxLength={1000}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#090d18] px-3 py-2 text-xs text-white outline-none focus:border-[#8bd3a7]"
            />
            <button type="submit" disabled={loading || !input.trim()} className="rounded-md bg-[#6eae89] px-3 text-[#102018] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send message">
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((current) => !current)} className="rounded-full border border-[#9b7650]/70 bg-[#14251f] p-1 shadow-xl transition-transform hover:scale-105" aria-label="Open S4FC customer support">
        <SfcCoinLogo size="md" />
      </button>
    </div>
  );
};
