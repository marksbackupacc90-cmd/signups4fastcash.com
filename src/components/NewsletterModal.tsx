import React, { useState } from 'react';
import { X, Send, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (email: string, frequency: 'instant' | 'daily' | 'weekly') => void;
  subscriberCount: number;
}

export const NewsletterModal: React.FC<NewsletterModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  subscriberCount,
}) => {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('instant');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    onSubscribe(email, frequency);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0c1017] border border-white/[0.12] p-6 shadow-2xl">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">You're On The VIP List!</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Whenever CashBot uncovers an urgent, high-value referral promo, you'll be among the first to know.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#00f2fe]/10 border border-[#00f2fe]/20 flex items-center justify-center text-[#00f2fe]">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Instant Earning Alerts</h3>
                <span className="text-[11px] font-mono text-zinc-400">
                  Join {subscriberCount.toLocaleString()} savvy signers
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Banks and fintechs regularly drop surprise $50–$300 referral matches that only last 48 hours. Get notified immediately when verified by CashBot.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
                  Your Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141824] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#00f2fe]/50 font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
                  Notification Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFrequency('instant')}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono transition-colors border ${
                      frequency === 'instant'
                        ? 'bg-[#00f2fe]/10 border-[#00f2fe]/40 text-[#00f2fe] font-bold'
                        : 'bg-[#141824] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    ⚡ Instant Drops
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono transition-colors border ${
                      frequency === 'daily'
                        ? 'bg-[#00f2fe]/10 border-[#00f2fe]/40 text-[#00f2fe] font-bold'
                        : 'bg-[#141824] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Daily Digest
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('weekly')}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono transition-colors border ${
                      frequency === 'weekly'
                        ? 'bg-[#00f2fe]/10 border-[#00f2fe]/40 text-[#00f2fe] font-bold'
                        : 'bg-[#141824] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Weekly Best
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#00f2fe] hover:bg-[#38bdf8] text-black font-semibold text-xs font-mono transition-all shadow-[0_0_20px_rgba(0,242,254,0.2)] active:scale-[0.99] mt-2"
              >
                Subscribe to Drops (100% Free)
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-zinc-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero spam. Unsubscribe anytime in 1 click.</span>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
