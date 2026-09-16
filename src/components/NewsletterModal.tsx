import React, { useState } from 'react';
import { X, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';

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
      <div className="relative w-full max-w-md rounded-2xl border border-[#2dd4ee]/25 bg-[#0d1724] p-6 shadow-2xl shadow-black/40">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">You're On The VIP List!</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              We'll send alerts for new offers that are added to the catalog. Always confirm the merchant's current terms.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2dd4ee]/25 bg-[#2dd4ee]/10 text-[#2dd4ee]">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Instant Earning Alerts</h3>
                <span className="text-[11px] font-mono text-zinc-400">
                  {subscriberCount > 0 ? `${subscriberCount.toLocaleString()} subscribers` : 'No subscriber count published'}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Receive email alerts when new offers are added. We do not publish unverified subscriber or payout numbers.
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
                  className="w-full rounded-lg border border-white/10 bg-[#0a1220] px-3.5 py-2.5 text-sm font-sans text-white placeholder:text-zinc-500 focus:border-[#2dd4ee]/60 focus:outline-none"
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
                        ? 'border-[#2dd4ee]/40 bg-[#2dd4ee]/10 font-bold text-[#2dd4ee]'
                        : 'border-white/10 bg-[#0a1220] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    ⚡ Instant Drops
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono transition-colors border ${
                      frequency === 'daily'
                        ? 'border-[#2dd4ee]/40 bg-[#2dd4ee]/10 font-bold text-[#2dd4ee]'
                        : 'border-white/10 bg-[#0a1220] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Daily Digest
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('weekly')}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono transition-colors border ${
                      frequency === 'weekly'
                        ? 'border-[#2dd4ee]/40 bg-[#2dd4ee]/10 font-bold text-[#2dd4ee]'
                        : 'border-white/10 bg-[#0a1220] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Weekly Best
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 w-full rounded-lg border border-[#2dd4ee]/60 bg-[#2dd4ee] py-2.5 text-xs font-mono font-semibold text-[#06131a] shadow-sm transition-all hover:bg-[#67e8f9] active:scale-[0.99]"
              >
                Subscribe to alerts
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
