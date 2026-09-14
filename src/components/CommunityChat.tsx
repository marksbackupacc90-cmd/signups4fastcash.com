import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

interface CommunityMessage {
  id: string;
  displayName: string;
  content: string;
  createdAt: string;
}

interface CommunityChatProps {
  username?: string | null;
  userId?: string;
}

export const CommunityChat: React.FC<CommunityChatProps> = ({ username, userId }) => {
  const [open, setOpen] = useState(false);
  const [visitorId] = useState(() => {
    const key = 's4fc_chat_visitor';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  });
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; username: string; avatarUrl?: string | null }>>([]);
  const [directUserId, setDirectUserId] = useState('');
  const [directMessages, setDirectMessages] = useState<Array<{ id: string; sender_id: string; content: string }>>([]);
  const displayName = username ? `@${username}` : 'Guest';

  useEffect(() => {
    if (!userId) return;
    fetch('/api/community-users').then((response) => response.ok ? response.json() : Promise.reject(new Error())).then((data: { users?: typeof users }) => setUsers(data.users || [])).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (!directUserId) return;
    fetch(`/api/direct-messages?userId=${encodeURIComponent(directUserId)}`).then((response) => response.ok ? response.json() : Promise.reject(new Error())).then((data: { messages?: typeof directMessages }) => setDirectMessages(data.messages || [])).catch(() => undefined);
  }, [directUserId]);

  const refresh = async () => {
    const response = await fetch(`/api/community-chat?visitorId=${encodeURIComponent(visitorId)}&displayName=${encodeURIComponent(displayName)}`);
    if (!response.ok) throw new Error('Could not load community chat.');
    const data = await response.json() as { messages: CommunityMessage[]; activeCount: number; activeUsers?: string[] };
    setMessages(data.messages);
    setActiveCount(data.activeCount);
    setActiveUsers(data.activeUsers || []);
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 10000);
    return () => window.clearInterval(interval);
  }, [visitorId]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    setLoading(true);
    try {
      const response = await fetch('/api/community-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, displayName, content }),
      });
      if (!response.ok) throw new Error('Could not send message.');
      setInput('');
      await refresh();
    } catch {
      // The next polling cycle will recover the chat connection.
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="fixed right-4 top-24 z-30 w-[min(20rem,calc(100vw-2rem))]">
      {open && (
        <section className="overflow-hidden rounded-xl border border-[#8bd3a7]/25 bg-[#14251f] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0e121a] px-3 py-2.5">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f1e6cf]">
                <MessageCircle className="h-4 w-4 text-[#8bd3a7]" />
                Community chat
              </div>
              <div className="mt-0.5 text-[10px] text-[#8bd3a7]">{activeCount} active now</div>
              <div className="mt-1 flex max-w-[15rem] flex-wrap gap-1">
                {activeUsers.length > 0 ? activeUsers.map((activeUser) => (
                  <span key={activeUser} className="inline-flex items-center gap-1 rounded-full bg-[#1c3329] px-1.5 py-0.5 text-[9px] text-[#d6eadb]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8bd3a7]" />
                    {activeUser}
                  </span>
                )) : <span className="text-[9px] text-zinc-500">No one is active yet</span>}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-[#f1e6cf]" aria-label="Close community chat">
              <X className="h-4 w-4" />
            </button>
          </div>
          {userId && (
            <div className="border-b border-white/[0.08] bg-[#0e121a] p-2.5">
              <select value={directUserId} onChange={(event) => setDirectUserId(event.target.value)} className="w-full rounded-md border border-white/10 bg-[#090d18] px-2 py-2 text-xs text-zinc-200">
                <option value="">Community chat</option>
                {users.map((entry) => <option key={entry.id} value={entry.id}>Message @{entry.username}</option>)}
              </select>
            </div>
          )}
          {directUserId ? (
            <>
              <div className="max-h-64 space-y-2 overflow-y-auto bg-[#141824] p-3">
                {directMessages.map((message) => <div key={message.id} className={`rounded-lg px-2.5 py-2 text-xs ${message.sender_id === userId ? 'ml-6 bg-[#6eae89] text-[#102018]' : 'mr-6 bg-[#0e121a] text-zinc-200'}`}>{message.content}</div>)}
              </div>
              <form onSubmit={async (event) => {
                event.preventDefault();
                const content = input.trim();
                if (!content || loading) return;
                setLoading(true);
                try {
                  const response = await fetch('/api/direct-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: directUserId, content }) });
                  if (!response.ok) throw new Error();
                  setInput('');
                  const refreshed = await fetch(`/api/direct-messages?userId=${encodeURIComponent(directUserId)}`);
                  if (refreshed.ok) setDirectMessages((await refreshed.json() as { messages: typeof directMessages }).messages || []);
                } finally {
                  setLoading(false);
                }
              }} className="flex gap-2 border-t border-white/[0.08] bg-[#0e121a] p-2.5">
                <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Direct message..." className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#090d18] px-2.5 py-2 text-xs text-white" />
                <button type="submit" disabled={loading || !input.trim()} className="rounded-md bg-[#6eae89] px-2.5 text-[#102018] disabled:opacity-50"><Send className="h-3.5 w-3.5" /></button>
              </form>
            </>
          ) : (
          <>
            <div className="max-h-64 space-y-2 overflow-y-auto bg-[#141824] p-3">
            {messages.length === 0 && <p className="py-5 text-center text-xs text-zinc-500">Be the first to say hello.</p>}
            {messages.map((message) => (
              <div key={message.id} className="rounded-lg bg-[#0e121a] px-2.5 py-2">
                <div className="text-[10px] font-semibold text-[#d6a96d]">{message.displayName}</div>
                <div className="mt-0.5 break-words text-xs leading-relaxed text-zinc-200">{message.content}</div>
              </div>
            ))}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/[0.08] bg-[#0e121a] p-2.5">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={280}
              placeholder="Say hello..."
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#090d18] px-2.5 py-2 text-xs text-white outline-none focus:border-[#8bd3a7]"
            />
            <button type="submit" disabled={loading || !input.trim()} className="rounded-md bg-[#6eae89] px-2.5 text-[#102018] disabled:opacity-50" aria-label="Send community message">
              <Send className="h-3.5 w-3.5" />
            </button>
            </form>
          </>
          )}
        </section>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="ml-auto flex items-center gap-2 rounded-full border border-[#9b7650]/70 bg-[#14251f] px-3 py-2 text-xs font-semibold text-[#f1e6cf] shadow-xl hover:bg-[#1c3329]">
          <MessageCircle className="h-4 w-4 text-[#8bd3a7]" />
          Chat <span className="text-[#8bd3a7]">{activeCount}</span>
        </button>
      )}
    </aside>
  );
};
