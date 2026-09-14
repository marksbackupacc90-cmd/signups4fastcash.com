import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, UserPlus, UserMinus, ShieldBan, X } from 'lucide-react';

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
  const [error, setError] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; username: string; avatarUrl?: string | null }>>([]);
  const [directUserId, setDirectUserId] = useState('');
  const [directMessages, setDirectMessages] = useState<Array<{ id: string; sender_id: string; content: string }>>([]);
  const [section, setSection] = useState<'community' | 'private'>('community');
  const [friends, setFriends] = useState<typeof users>([]);
  const [friendCandidates, setFriendCandidates] = useState<typeof users>([]);
  const [friendName, setFriendName] = useState('');
  const displayName = username ? `@${username}` : 'Guest';

  useEffect(() => {
    if (!userId) return;
    fetch('/api/friends').then((response) => response.ok ? response.json() : Promise.reject(new Error())).then((data: { friends?: typeof users; users?: typeof users }) => {
      setFriends(data.friends || []);
      setFriendCandidates(data.users || []);
      setUsers(data.friends || []);
    }).catch(() => undefined);
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
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || 'Could not send message.');
      }
      setInput('');
      setError('');
      await refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send message.');
    } finally {
      setLoading(false);
    }
  };

  const formatMessageTime = (createdAt: string) => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(createdAt));

  const refreshFriends = async () => {
    const response = await fetch('/api/friends');
    if (!response.ok) return;
    const data = await response.json() as { friends?: typeof users; users?: typeof users };
    setFriends(data.friends || []);
    setFriendCandidates(data.users || []);
    setUsers(data.friends || []);
  };

  const updateFriend = async (name: string, action: 'active' | 'block') => {
    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, action }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      setError(data?.error || 'Could not update friend.');
      return;
    }
    setFriendName('');
    setError('');
    await refreshFriends();
  };

  const removeFriend = async (friendId: string) => {
    await fetch(`/api/friends/${encodeURIComponent(friendId)}`, { method: 'DELETE' });
    if (directUserId === friendId) setDirectUserId('');
    await refreshFriends();
  };

  return (
    <aside className="relative inline-block shrink-0">
      {open && (
        <section className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#8bd3a7]/25 bg-[#14251f] shadow-2xl">
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
          <div className="grid grid-cols-2 border-b border-white/[0.08] bg-[#0e121a] p-1">
            <button type="button" onClick={() => setSection('community')} className={`rounded-md px-2 py-1.5 text-xs ${section === 'community' ? 'bg-[#6eae89] font-semibold text-[#102018]' : 'text-zinc-400'}`}>Community</button>
            <button type="button" onClick={() => setSection('private')} className={`rounded-md px-2 py-1.5 text-xs ${section === 'private' ? 'bg-[#6eae89] font-semibold text-[#102018]' : 'text-zinc-400'}`}>Private</button>
          </div>
          {section === 'private' && userId && (
            <div className="border-b border-white/[0.08] bg-[#0e121a] p-2.5">
              <div className="mb-2 flex gap-1.5">
                <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="Username to add or block" className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#090d18] px-2 py-1.5 text-xs text-white" />
                <button type="button" onClick={() => void updateFriend(friendName, 'active')} disabled={!friendName.trim()} className="rounded-md bg-[#6eae89] px-2 text-[#102018] disabled:opacity-50" title="Add friend"><UserPlus className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => void updateFriend(friendName, 'block')} disabled={!friendName.trim()} className="rounded-md border border-red-300/30 px-2 text-red-200 disabled:opacity-50" title="Block user"><ShieldBan className="h-3.5 w-3.5" /></button>
              </div>
              <select value={directUserId} onChange={(event) => setDirectUserId(event.target.value)} className="w-full rounded-md border border-white/10 bg-[#090d18] px-2 py-2 text-xs text-zinc-200">
                <option value="">Select a friend</option>
                {friends.map((entry) => <option key={entry.id} value={entry.id}>@{entry.username}</option>)}
              </select>
              <div className="mt-2 space-y-1">
                {friends.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded bg-[#141824] px-2 py-1.5 text-[10px] text-zinc-300"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#8bd3a7]" />@{entry.username}</span><button type="button" onClick={() => void removeFriend(entry.id)} className="text-zinc-500 hover:text-red-200" title="Remove friend"><UserMinus className="h-3 w-3" /></button></div>)}
                {friends.length === 0 && <div className="text-[10px] text-zinc-500">No friends yet. Add someone by username.</div>}
              </div>
            </div>
          )}
          {section === 'private' && !userId ? (
            <div className="bg-[#141824] px-3 py-8 text-center text-xs text-zinc-400">Sign in to add friends and send private messages.</div>
          ) : section === 'private' && directUserId ? (
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
          ) : section === 'community' ? (
          <>
            <div className="max-h-64 space-y-2 overflow-y-auto bg-[#141824] p-3">
            {messages.length === 0 && <p className="py-5 text-center text-xs text-zinc-500">Be the first to say hello.</p>}
            {messages.map((message) => (
              <div key={message.id} className="rounded-lg bg-[#0e121a] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold text-[#d6a96d]">{message.displayName}</div>
                  <time dateTime={message.createdAt} className="text-[9px] text-zinc-500">{formatMessageTime(message.createdAt)}</time>
                </div>
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
            {error && <div className="px-3 pb-2 text-[10px] text-[#f2a7a7]">{error}</div>}
          </>
          ) : <div className="bg-[#141824] px-3 py-8 text-center text-xs text-zinc-500">Choose a friend to start a private conversation.</div>}
        </section>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="retro-button ml-1 flex min-w-[7.5rem] items-center justify-center gap-2 rounded-md border border-white/15 px-5 py-2 text-xs font-medium text-zinc-200 hover:bg-[#141824] hover:text-[#f1e6cf] md:ml-3">
          <MessageCircle className="h-4 w-4 text-[#8bd3a7]" />
          Chat <span className="text-[#8bd3a7]">{activeCount}</span>
        </button>
      )}
    </aside>
  );
};
