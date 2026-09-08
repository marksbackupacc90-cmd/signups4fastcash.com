import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Sparkles, 
  Send, 
  Zap, 
  Calculator, 
  FileSearch, 
  Scale, 
  Gauge, 
  CheckCircle2, 
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { Offer } from '../types';

interface AICouncilModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableOffers: Offer[];
  onSelectOffer: (offerId: string) => void;
}

interface CouncilRecommendation {
  company: string;
  incentive: string;
  whySelected: string;
  deepseekRoi: string;
  llamaCatchNotice: string;
  mistralRating: string;
  qwenSpeedEstimate: string;
}

interface CouncilResult {
  consensusTitle: string;
  consensusVerdict: string;
  confidenceScore: number;
  topRecommendedOffers: CouncilRecommendation[];
  modelPerspectives: {
    gemini: string;
    deepseek: string;
    llama: string;
    mistral: string;
    qwen: string;
  };
  optimalStackingStrategy: string;
}

const PRESET_SCENARIOS = [
  {
    id: 'instant-low-dep',
    label: '⚡ $0 - $1 Low Deposit Drops',
    query: 'Show me the best offers requiring $0 to $1 deposit that payout cash or stock immediately.'
  },
  {
    id: 'highest-payout',
    label: '💰 Highest Cash Payouts ($100 - $300)',
    query: 'Find the highest absolute cash bonuses currently active with clear terms and zero hidden traps.'
  },
  {
    id: 'fastest-speedrun',
    label: '⏱️ Under 5-Minute Speedruns',
    query: 'What offers can I finish in under 5 minutes right now on my phone?'
  },
  {
    id: 'stacking-routine',
    label: '🧩 3-App Stacking Master Routine',
    query: 'What is the highest-yield 3-step stacking combination I can complete in one session today?'
  }
];

export const AICouncilModal: React.FC<AICouncilModalProps> = ({
  isOpen,
  onClose,
  availableOffers,
  onSelectOffer
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [activeModelTab, setActiveModelTab] = useState<'all' | 'deepseek' | 'llama' | 'mistral' | 'qwen' | 'gemini'>('all');

  if (!isOpen) return null;

  const handleRunCouncil = async (queryText?: string) => {
    const textToRun = queryText || query;
    if (!textToRun.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/ai-council/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToRun })
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
      }
    } catch (err) {
      console.error('Failed to query Omni-AI Council:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="omni-ai-council-modal"
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#090d15] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/40 flex flex-col overflow-hidden"
      >
        {/* Header with High-Tech Branding */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-[#0c121e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono flex items-center gap-1.5">
                  Omni-AI Council
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-normal">
                    5 Unified Engines
                  </span>
                </h2>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Gemini • DeepSeek R1 • Meta LLaMA 3.3 • Mistral • Qwen 2.5
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="close-ai-council-modal"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Prompt Presets */}
          <div>
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2 font-semibold">
              Instant AI Council Presets
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setQuery(preset.query);
                    handleRunCouncil(preset.query);
                  }}
                  disabled={loading}
                  className="p-2.5 rounded-lg bg-[#121824] hover:bg-[#182030] border border-white/[0.06] hover:border-cyan-500/40 text-left text-xs text-zinc-200 transition-all group flex items-center justify-between"
                >
                  <span className="font-medium group-hover:text-cyan-300 transition-colors">
                    {preset.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt Input */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block font-semibold">
              Or Ask the 5-AI Syndicate Directly
            </span>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunCouncil()}
                placeholder="e.g. 'I have $10 and 15 minutes, what order should I do these in?'"
                className="w-full px-4 py-3 rounded-xl bg-[#121826] border border-white/[0.1] focus:border-cyan-500/60 focus:outline-none text-sm text-white placeholder:text-zinc-500 pr-24 font-sans"
              />
              <button
                onClick={() => handleRunCouncil()}
                disabled={loading || !query.trim()}
                id="run-omni-ai-btn"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Consult</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Council Synthesis Output */}
          {loading && (
            <div className="p-8 rounded-xl bg-[#0e131e] border border-cyan-500/20 text-center space-y-4">
              <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-spin">
                <Cpu className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Synthesizing Multi-Model Consensus...
                </h3>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">DeepSeek Math Calculating</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">LLaMA 3.3 Traps Scanning</span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Mistral Compliance Auditing</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Qwen Speedrun Plotting</span>
                </div>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Main Consensus Verdict Box */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#0d1422] border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Council Consensus Reached
                    </span>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                    {result.confidenceScore}% Confidence
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white font-sans">
                  {result.consensusTitle}
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                  {result.consensusVerdict}
                </p>

                {/* Stacking Strategy Recommendation */}
                {result.optimalStackingStrategy && (
                  <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-xs font-sans text-cyan-200 flex items-start gap-2">
                    <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-mono text-[11px] uppercase tracking-wider text-cyan-300 block">Optimal Execution Stacking:</strong>
                      <span>{result.optimalStackingStrategy}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual 5-AI Perspectives Tabs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                    Individual AI Perspectives
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveModelTab('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        activeModelTab === 'all' 
                          ? 'bg-white/15 text-white font-bold' 
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      All 5 Models
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  
                  {/* DeepSeek */}
                  <div className="p-3 rounded-xl bg-[#0f1522] border border-blue-500/20">
                    <div className="flex items-center gap-1.5 text-blue-400 font-mono font-bold text-xs mb-1">
                      <Calculator className="w-3.5 h-3.5" />
                      <span>DeepSeek R1 (Math & ROI)</span>
                    </div>
                    <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                      {result.modelPerspectives.deepseek}
                    </p>
                  </div>

                  {/* LLaMA */}
                  <div className="p-3 rounded-xl bg-[#0f1522] border border-amber-500/20">
                    <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold text-xs mb-1">
                      <FileSearch className="w-3.5 h-3.5" />
                      <span>Meta LLaMA 3.3 (Fine Print & Traps)</span>
                    </div>
                    <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                      {result.modelPerspectives.llama}
                    </p>
                  </div>

                  {/* Mistral */}
                  <div className="p-3 rounded-xl bg-[#0f1522] border border-purple-500/20">
                    <div className="flex items-center gap-1.5 text-purple-400 font-mono font-bold text-xs mb-1">
                      <Scale className="w-3.5 h-3.5" />
                      <span>Mistral Large (Banking Compliance)</span>
                    </div>
                    <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                      {result.modelPerspectives.mistral}
                    </p>
                  </div>

                  {/* Qwen */}
                  <div className="p-3 rounded-xl bg-[#0f1522] border border-emerald-500/20">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs mb-1">
                      <Gauge className="w-3.5 h-3.5" />
                      <span>Qwen 2.5 (Speedrun Efficiency)</span>
                    </div>
                    <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                      {result.modelPerspectives.qwen}
                    </p>
                  </div>
                </div>

                {/* Gemini Live Scraper */}
                <div className="p-2.5 rounded-lg bg-[#0e131c] border border-white/[0.05] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                  <span className="text-cyan-400">Google Gemini 3.8 Live Discovery:</span>
                  <span className="text-zinc-300">{result.modelPerspectives.gemini}</span>
                </div>
              </div>

              {/* Recommended Offers from Catalog */}
              {result.topRecommendedOffers && result.topRecommendedOffers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                    Target Opportunities Endorsed by the Council
                  </span>
                  <div className="space-y-2">
                    {result.topRecommendedOffers.map((rec, i) => (
                      <div 
                        key={i} 
                        className="p-3 rounded-xl bg-[#121826] border border-white/[0.08] hover:border-cyan-500/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-sm font-sans">{rec.company}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold">
                              {rec.incentive}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 font-sans mt-0.5">{rec.whySelected}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-400 flex-wrap">
                            <span className="text-blue-400">Math: {rec.deepseekRoi}</span>
                            <span className="text-amber-400">Trap Check: {rec.llamaCatchNotice}</span>
                            <span className="text-emerald-400">Speed: {rec.qwenSpeedEstimate}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const match = availableOffers.find(o => 
                              o.company.toLowerCase().includes(rec.company.toLowerCase()) || 
                              rec.company.toLowerCase().includes(o.company.toLowerCase())
                            );
                            if (match) {
                              onSelectOffer(match.id);
                              onClose();
                            } else {
                              onClose();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs shrink-0 flex items-center gap-1 transition-colors"
                        >
                          <span>View Offer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-[#0c121e] flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero Payment Interference • 100% Free Transparent Intelligence</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-white/[0.06] hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
