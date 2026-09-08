import React, { useState } from 'react';
import { Bell, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

interface PushNotificationBannerProps {
  pushEnabled: boolean;
  onEnablePush: () => void;
  onDismiss: () => void;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({
  pushEnabled,
  onEnablePush,
  onDismiss,
}) => {
  if (pushEnabled) return null;

  return (
    <div className="bg-gradient-to-r from-blue-950/40 via-[#101624] to-cyan-950/30 border-y border-white/[0.08] px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-zinc-300">
          <div className="w-6 h-6 rounded bg-[#00f2fe]/10 border border-[#00f2fe]/30 flex items-center justify-center text-[#00f2fe] shrink-0">
            <Bell className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span>
            <strong className="text-white font-mono">Push Alerts:</strong> Get notified the moment CashBot approves a high-yield bonus ($50+ signups).
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEnablePush}
            id="enable-push-banner-btn"
            className="px-3 py-1 rounded bg-[#00f2fe] hover:bg-[#38bdf8] text-black font-semibold font-mono text-[11px] transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Enable Push Notifications
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded text-zinc-400 hover:text-white"
            title="Dismiss for now"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
