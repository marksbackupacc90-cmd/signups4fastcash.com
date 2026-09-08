import React, { useState } from 'react';
import { X, Sparkles, Download, Copy, Check, ShieldCheck, Zap, Server } from 'lucide-react';
import { Offer } from '../types';

interface StaticExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  offers: Offer[];
}

export const StaticExportModal: React.FC<StaticExportModalProps> = ({
  isOpen,
  onClose,
  offers,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const exportPayload = {
    site: 'signups4fastcash.com',
    generator: 'Static Site Generator (SSG v4.2)',
    generatedAt: new Date().toISOString(),
    totalOffers: offers.length,
    architecture: {
      type: 'Jamstack SSG',
      edgeCaching: 'Cloudflare / Vercel Edge Compatible',
      securityProfile: 'Zero database exposure, zero payment processing',
      paymentCustody: '100% Non-custodial direct merchant affiliate payouts',
    },
    offers: offers.map((o) => ({
      id: o.id,
      company: o.company,
      title: o.title,
      category: o.category,
      incentive: o.incentiveAmount,
      depositReq: o.depositRequired,
      payoutSpeed: o.payoutSpeed,
      difficulty: o.difficulty,
      referralCode: o.referralCode,
      referralUrl: o.referralUrl,
      theCatch: o.honestTruth.theCatch,
      speedrunGuide: o.speedrunHints,
    })),
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signups4fastcash-ssg-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0c1017] border border-white/[0.12] p-6 shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00f2fe]/10 border border-[#00f2fe]/20 flex items-center justify-center text-[#00f2fe]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Static Site Generator (SSG) Engine
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Sub-10ms TTFB
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                signups4fastcash.com compiles to pure immutable static assets for ultra-high security and near-zero server maintenance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Benefits banner */}
        <div className="my-4 grid grid-cols-3 gap-2.5 text-center text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#141824] border border-white/[0.04]">
            <span className="text-emerald-400 block font-bold">0 Vulnerabilities</span>
            <span className="text-[10px] text-zinc-400">No open DB endpoints</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#141824] border border-white/[0.04]">
            <span className="text-[#00f2fe] block font-bold">100% Edge Cached</span>
            <span className="text-[10px] text-zinc-400">Lightning fast globally</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#141824] border border-white/[0.04]">
            <span className="text-purple-400 block font-bold">$0 Hosting Overhead</span>
            <span className="text-[10px] text-zinc-400">Zero database upkeep</span>
          </div>
        </div>

        {/* Code viewer */}
        <div className="flex-1 min-h-0 bg-[#07090e] rounded-lg border border-white/[0.08] p-3 overflow-hidden flex flex-col font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04] text-[11px] text-zinc-400">
            <span>static-build-manifest.json ({offers.length} offers)</span>
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1 text-zinc-300 hover:text-white"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy Feed'}</span>
            </button>
          </div>
          <pre className="flex-1 overflow-auto text-[11px] text-zinc-300 p-2 scrollbar-thin">
            {jsonString}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-500">
            Compatible with Vercel, Cloudflare Pages, Netlify, and GitHub Pages.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="px-3 py-2 rounded-lg bg-[#141824] hover:bg-[#18202e] border border-white/10 text-xs font-mono text-white transition-colors"
            >
              Copy JSON
            </button>
            <button
              onClick={handleDownloadFile}
              className="px-4 py-2 rounded-lg bg-[#00f2fe] hover:bg-[#38bdf8] text-black font-semibold font-mono text-xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download Build Manifest
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
