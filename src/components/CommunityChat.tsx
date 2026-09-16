import React, { useEffect, useRef, useState } from 'react';
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

type FriendEntry = { id: string; username: string; avatarUrl?: string | null; lastOnline?: string | null };

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
  const [users, setUsers] = useState<FriendEntry[]>([]);
  const [directUserId, setDirectUserId] = useState('');
  const [directMessages, setDirectMessages] = useState<Array<{ id: string; sender_id: string; content: string }>>([]);
  const [section, setSection] = useState<'community' | 'private'>('community');
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<FriendEntry[]>([]);
  const [friendName, setFriendName] = useState('');
  const [contextUser, setContextUser] = useState<{ name: string; x: number; y: number } | null>(null);
  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now());
  const [mutedUsers, setMutedUsers] = useState<string[]>(() => JSON.parse(localStorage.getItem('s4fc_muted_chat_users') || '[]') as string[]);
  const communityMessagesRef = useRef<HTMLDivElement | null>(null);
  const directMessagesRef = useRef<HTMLDivElement | null>(null);
  const chatMenuRef = useRef<HTMLElement | null>(null);
  const displayName = username ? `@${username}` : 'Guest';

  useEffect(() => {
    if (!open && !contextUser) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setContextUser(null);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [open, contextUser]);

  const scrollToLatest = () => {
    const container = section === 'private' ? directMessagesRef.current : communityMessagesRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      container.scrollTop = container.scrollHeight;
    });
  };

  useEffect(() => {
    if (!open) return;
    scrollToLatest();
  }, [open, section, messages.length, directMessages.length]);

  useEffect(() => {
    if (!userId) return;
    const loadFriends = () => {
      fetch('/api/friends').then((response) => response.ok ? response.json() : Promise.reject(new Error())).then((data: { friends?: FriendEntry[]; blocked?: FriendEntry[] }) => {
        setFriends(data.friends || []);
        setBlockedUsers(data.blocked || []);
        setUsers(data.friends || []);
      }).catch(() => undefined);
    };
    loadFriends();
    const interval = window.setInterval(loadFriends, 10000);
    return () => window.clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const interval = window.setInterval(() => setRelativeTimeNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

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
  }, [visitorId, displayName]);

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

  const formatLastOnline = (lastOnline: string | null | undefined) => {
    if (!lastOnline) return 'last seen unknown';
    const elapsedSeconds = Math.max(0, Math.floor((relativeTimeNow - new Date(lastOnline).getTime()) / 1000));
    if (elapsedSeconds < 60) return 'last seen just now';
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `last seen ${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `last seen ${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 30) return `last seen ${elapsedDays}d ago`;
    return `last seen ${Math.floor(elapsedDays / 30)}mo ago`;
  };

  const refreshFriends = async () => {
    const response = await fetch('/api/friends');
    if (!response.ok) return;
    const data = await response.json() as { friends?: FriendEntry[]; blocked?: FriendEntry[] };
    setFriends(data.friends || []);
    setBlockedUsers(data.blocked || []);
    setUsers(data.friends || []);
  };

  const updateFriend = async (name: string, action: 'active' | 'block') => {
    const cleanName = name.trim().replace(/^@/, '');
    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanName, action }),
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

  const muteUser = (name: string) => {
    const next = mutedUsers.includes(name) ? mutedUsers.filter((entry) => entry !== name) : [...mutedUsers, name];
    setMutedUsers(next);
    localStorage.setItem('s4fc_muted_chat_users', JSON.stringify(next));
    setContextUser(null);
  };

  const openDirectMessage = (name: string) => {
    const friend = friends.find((entry) => `@${entry.username}` === name);
    if (friend) {
      setSection('private');
      setDirectUserId(friend.id);
    } else if (userId) {
      void updateFriend(name, 'active');
    }
    setContextUser(null);
  };

  const removeFriend = async (friendId: string) => {
    await fetch(`/api/friends/${encodeURIComponent(friendId)}`, { method: 'DELETE' });
    if (directUserId === friendId) setDirectUserId('');
    await refreshFriends();
  };

  return (
    <aside ref={chatMenuRef} className="fixed bottom-5 right-5 z-40 inline-block">
      {open && (
        <section className="absolute bottom-full right-0 z-50 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#8bd3a7]/25 bg-[#14251f] shadow-2xl">
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
                <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="Add friend by username" className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#090d18] px-2 py-1.5 text-xs text-white" />
                <button type="button" onClick={() => void updateFriend(friendName, 'active')} disabled={!friendName.trim()} className="rounded-md bg-[#6eae89] px-2 text-[#102018] disabled:opacity-50" title="Add friend"><UserPlus className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => void updateFriend(friendName, 'block')} disabled={!friendName.trim()} className="rounded-md border border-red-300/30 px-2 text-red-200 disabled:opacity-50" title="Block user"><ShieldBan className="h-3.5 w-3.5" /></button>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">Friends</div>
                {friends.map((entry) => {
                  const online = activeUsers.includes(`@${entry.username}`);
                  return <div key={entry.id} className="flex items-center gap-1 rounded bg-[#141824] px-2 py-1.5 text-[10px] text-zinc-300">
                    <button type="button" onClick={() => setDirectUserId(entry.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${online ? 'bg-[#8bd3a7] shadow-[0_0_7px_#8bd3a7]' : 'bg-red-400'}`} />
                      <span className="min-w-0">
                        <span className="block truncate">@{entry.username}</span>
                        {!online && <span className="block text-[9px] text-zinc-500">{formatLastOnline(entry.lastOnline)}</span>}
                      </span>
                    </button>
                    <button type="button" onClick={() => void removeFriend(entry.id)} className="text-zinc-500 hover:text-red-200" title="Remove friend"><UserMinus className="h-3 w-3" /></button>
                  </div>;
                })}
                {friends.length === 0 && <div className="text-[10px] text-zinc-500">No friends yet. Add someone by username.</div>}
                <div className="pt-2 text-[9px] uppercase tracking-wider text-zinc-500">Blocked</div>
                {blockedUsers.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded bg-[#141824] px-2 py-1.5 text-[10px] text-red-200"><span>@{entry.username}</span><button type="button" onClick={() => void removeFriend(entry.id)} className="text-zinc-500 hover:text-[#8bd3a7]" title="Unblock user">Unblock</button></div>)}
                {blockedUsers.length === 0 && <div className="text-[10px] text-zinc-500">No blocked users.</div>}
              </div>
            </div>
          )}
          {section === 'private' && !userId ? (
            <div className="bg-[#141824] px-3 py-8 text-center text-xs text-zinc-400">Sign in to add friends and send private messages.</div>
          ) : section === 'private' && directUserId ? (
            <>
              <div ref={directMessagesRef} className="max-h-64 space-y-2 overflow-y-auto bg-[#141824] p-3">
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
                  if (refreshed.ok) {
                    const nextMessages = (await refreshed.json() as { messages: typeof directMessages }).messages || [];
                    setDirectMessages(nextMessages);
                    setTimeout(scrollToLatest, 0);
                  }
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
            <div ref={communityMessagesRef} className="max-h-64 space-y-2 overflow-y-auto bg-[#141824] p-3">
            {messages.length === 0 && <p className="py-5 text-center text-xs text-zinc-500">Be the first to say hello.</p>}
            {messages.map((message) => (
              <div key={message.id} onContextMenu={(event) => { event.preventDefault(); setContextUser({ name: message.displayName, x: event.clientX, y: event.clientY }); }} className={`rounded-lg bg-[#0e121a] px-2.5 py-2 ${mutedUsers.includes(message.displayName) ? 'opacity-40' : ''}`}>
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
        <button type="button" onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => scrollToLatest());
        }} className="retro-button focus-ring flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#14251f] px-3 py-3 text-xs font-medium text-zinc-200 shadow-xl hover:bg-[#1b352b] hover:text-[#f1e6cf] sm:gap-2 sm:px-4" aria-label={`Open community chat (${activeCount} active)`}>
          <MessageCircle className="h-4 w-4 text-[#8bd3a7]" />
          <span className="hidden sm:inline">Chat</span>
          <span className="text-[#8bd3a7]">{activeCount}</span>
        </button>
      )}
      {contextUser && (
        <div style={{ left: contextUser.x, top: contextUser.y }} className="fixed z-[70] w-40 rounded-lg border border-white/10 bg-[#0e121a] p-1 shadow-2xl">
          <button type="button" onClick={() => openDirectMessage(contextUser.name)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10"><UserPlus className="h-3.5 w-3.5" /> Add as friend</button>
          <button type="button" onClick={() => muteUser(contextUser.name)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-white/10">{mutedUsers.includes(contextUser.name) ? 'Unmute' : 'Mute'} {contextUser.name}</button>
          <button type="button" onClick={() => { void updateFriend(contextUser.name, 'block'); setContextUser(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-200 hover:bg-white/10"><ShieldBan className="h-3.5 w-3.5" /> Block</button>
        </div>
      )}
    </aside>
  );
};
