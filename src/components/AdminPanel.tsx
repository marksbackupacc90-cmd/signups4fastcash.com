import React, { useState } from 'react';
import { 
  Bot, 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Send, 
  Bell, 
  PlusCircle, 
  Trash2, 
  Sparkles, 
  Link as LinkIcon, 
  Code, 
  ShieldCheck, 
  FileText,
  AlertCircle,
  ExternalLink,
  Lock,
  Copy,
  Check,
  Search,
  Save,
  ArrowUpRight
} from 'lucide-react';
import { Offer, NewsletterSubscriber, EmailBlastLog, SpeedrunStep } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface AdminPanelProps {
  pendingOffers: Offer[];
  liveOffers: Offer[];
  subscribers: NewsletterSubscriber[];
  onApproveOffer: (
    offerId: string, 
    referralCode: string, 
    referralUrl: string, 
    blastEmail: boolean,
    updatedOffer?: Partial<Offer>
  ) => void;
  onRejectOffer: (offerId: string) => void;
  onUpdateLiveOffer: (offerId: string, updates: Partial<Offer>) => void;
  onDeleteLiveOffer: (offerId: string) => void;
  onCreateCustomOffer: (newOffer: Omit<Offer, 'id' | 'clicksCount' | 'conversionsCount' | 'createdAt' | 'updatedAt'>) => void;
  blastLogs: EmailBlastLog[];
  onLockAdmin?: () => void;
}

export interface UserReferralPreset {
  company: string;
  code: string;
  url: string;
  bonus: string;
  matchKeys: string[];
}

export const USER_REFERRAL_PRESETS: UserReferralPreset[] = [
  {
    company: 'Stake.us',
    code: 'fastcash',
    url: 'https://stake.us/?c=fastcash',
    bonus: '$25 Free Cash + 250k Coins',
    matchKeys: ['stake', 'stake.us'],
  },
  {
    company: 'Freecash',
    code: 'wintercash',
    url: 'https://freecash.com/r/wintercash',
    bonus: '$5 - $250 Chest + Instant Cashout',
    matchKeys: ['freecash'],
  },
  {
    company: 'Chime',
    code: 'markwinters39',
    url: 'https://www.chime.com/r/markwinters39/',
    bonus: '$100 Direct Deposit Match',
    matchKeys: ['chime'],
  },
  {
    company: 'SoFi Checking',
    code: '72836365',
    url: 'https://www.sofi.com/invite/coach?gcp=72836365-7180-469f-bfe5-42d8c2578a99&isAliasGcp=false&siid=e2c1795c-e596-4927-a73f-cfe51c7ea3d7',
    bonus: '$25 - $300 Instant Cash',
    matchKeys: ['sofi'],
  },
  {
    company: 'Capital One Shopping',
    code: '090a1fc7',
    url: 'https://capitaloneshopping.com/r/090a1fc7-f110-485e-a500-d6e27f6155a8',
    bonus: '$30 - $100 Shopping Rebates',
    matchKeys: ['capital one', 'capitalone'],
  },
  {
    company: 'AceBet',
    code: 'casino',
    url: 'https://acebet.cc/welcome/r/casino',
    bonus: '100% Match Bonus',
    matchKeys: ['acebet'],
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  pendingOffers,
  liveOffers,
  subscribers,
  onApproveOffer,
  onRejectOffer,
  onUpdateLiveOffer,
  onDeleteLiveOffer,
  onCreateCustomOffer,
  blastLogs,
  onLockAdmin,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'pending' | 'live' | 'create' | 'blasts'>('live');

  // Live Offers inline draft referral inputs and filters
  const [draftCodes, setDraftCodes] = useState<Record<string, string>>({});
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [liveSearchFilter, setLiveSearchFilter] = useState<string>('');

  // For pending approval review state
  const [selectedPendingId, setSelectedPendingId] = useState<string>(
    pendingOffers[0]?.id || ''
  );
  const [referralCodeInput, setReferralCodeInput] = useState<string>('');
  const [referralUrlInput, setReferralUrlInput] = useState<string>('');
  const [blastEmailCheckbox, setBlastEmailCheckbox] = useState<boolean>(true);

  // Manual create offer form state
  const [newCompany, setNewCompany] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'fintech' | 'brokerage' | 'cashback' | 'apps' | 'crypto'>('fintech');
  const [newIncentive, setNewIncentive] = useState('$50 Cash Bonus');
  const [newIncentiveVal, setNewIncentiveVal] = useState(50);
  const [newPayoutSpeed, setNewPayoutSpeed] = useState('Instant');
  const [newDifficulty, setNewDifficulty] = useState<'Easy (2 min)' | 'Fast (5 min)' | 'Standard (10 min)'>('Easy (2 min)');
  const [newDeposit, setNewDeposit] = useState('$1 deposit');
  const [newRefCode, setNewRefCode] = useState('MYCODE2026');
  const [newRefUrl, setNewRefUrl] = useState('https://partner.com/r/MYCODE2026');
  const [newHonestSummary, setNewHonestSummary] = useState('');
  const [newHonestCatch, setNewHonestCatch] = useState('');
  const [newMinHold, setNewMinHold] = useState('None');
  const [newSpeedrunSteps, setNewSpeedrunSteps] = useState<SpeedrunStep[]>([
    { step: 1, instruction: 'Click through verified link and register.', proTip: 'Match your legal name on ID.' },
    { step: 2, instruction: 'Fund minimum $1 using debit or checking.', proTip: 'Instant deposit unlocks bonus.' },
    { step: 3, instruction: 'Bonus posts to account. Withdraw back to bank.', proTip: 'Zero withdrawal fees.' },
  ]);

  const selectedPendingOffer = pendingOffers.find((o) => o.id === selectedPendingId);

  // Sync default values when changing pending selection
  const handleSelectPending = (offer: Offer) => {
    setSelectedPendingId(offer.id);
    setReferralCodeInput(offer.referralCode === 'PENDING_ADMIN_CODE' ? '' : (offer.referralCode || ''));
    setReferralUrlInput(offer.referralUrl.includes('PENDING_ADMIN_CODE') ? '' : offer.referralUrl);
  };

  const handleApprove = () => {
    if (!selectedPendingOffer) return;
    onApproveOffer(
      selectedPendingOffer.id,
      referralCodeInput.trim() || 'CLAIM-NOW',
      referralUrlInput.trim() || selectedPendingOffer.officialMerchantUrl,
      blastEmailCheckbox
    );
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newTitle) return;

    onCreateCustomOffer({
      company: newCompany,
      companySlug: newCompany.toLowerCase().replace(/[^a-z0-9]/g, ''),
      title: newTitle,
      category: newCategory,
      incentiveAmount: newIncentive,
      incentiveValue: newIncentiveVal,
      payoutSpeed: newPayoutSpeed,
      difficulty: newDifficulty,
      depositRequired: newDeposit,
      officialMerchantUrl: newRefUrl || 'https://google.com',
      referralCode: newRefCode,
      referralUrl: newRefUrl,
      status: 'live',
      honestTruth: {
        summary: newHonestSummary || 'Fully tested promo verified by our editorial staff.',
        theCatch: newHonestCatch || 'Must complete standard ID verification and minimum deposit requirement.',
        minimumHoldTime: newMinHold,
        idVerificationRequired: true,
        hiddenFeesWarning: 'Zero monthly account maintenance fees.',
        trustScore: 98,
      },
      speedrunHints: newSpeedrunSteps,
    });

    // Reset
    setNewCompany('');
    setNewTitle('');
    setActiveAdminTab('live');
  };

  const handleDraftCodeChange = (offerId: string, val: string) => {
    setDraftCodes((prev) => ({ ...prev, [offerId]: val }));
  };

  const handleDraftUrlChange = (offerId: string, val: string) => {
    setDraftUrls((prev) => ({ ...prev, [offerId]: val }));
  };

  const handleSaveOfferReferral = (offer: Offer) => {
    const newCode = draftCodes[offer.id] !== undefined ? draftCodes[offer.id] : (offer.referralCode || '');
    const newUrl = draftUrls[offer.id] !== undefined ? draftUrls[offer.id] : (offer.referralUrl || '');
    onUpdateLiveOffer(offer.id, {
      referralCode: newCode.trim(),
      referralUrl: newUrl.trim(),
    });
    setSavedSuccessIds((prev) => ({ ...prev, [offer.id]: true }));
    setTimeout(() => {
      setSavedSuccessIds((prev) => ({ ...prev, [offer.id]: false }));
    }, 2500);
  };

  const handleApplyPresetToOffer = (offerId: string, preset: UserReferralPreset) => {
    setDraftCodes((prev) => ({ ...prev, [offerId]: preset.code }));
    setDraftUrls((prev) => ({ ...prev, [offerId]: preset.url }));
    onUpdateLiveOffer(offerId, {
      referralCode: preset.code,
      referralUrl: preset.url,
    });
    setSavedSuccessIds((prev) => ({ ...prev, [offerId]: true }));
    setTimeout(() => {
      setSavedSuccessIds((prev) => ({ ...prev, [offerId]: false }));
    }, 2500);
  };

  const handleCopyCode = (code: string, id: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const filteredLiveOffers = liveOffers.filter((o) => {
    if (!liveSearchFilter) return true;
    const q = liveSearchFilter.toLowerCase();
    return (
      o.company.toLowerCase().includes(q) ||
      o.title.toLowerCase().includes(q) ||
      (o.referralCode && o.referralCode.toLowerCase().includes(q)) ||
      (o.referralUrl && o.referralUrl.toLowerCase().includes(q)) ||
      o.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#0f1420] border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              Admin Control Center
            </h2>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono">
              Owner Mode
            </span>
            {onLockAdmin && (
              <button
                id="btn-lock-admin"
                onClick={onLockAdmin}
                title="Lock and hide Admin Panel until secret code is entered in search"
                className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Lock & Hide</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Review CashBot automated discoveries, attach your affiliate codes, and trigger email blasts to {subscribers.length} newsletter subscribers.
          </p>
        </div>

        {/* Sub-nav tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#07090e] border border-white/10 font-mono text-xs shrink-0 flex-wrap">
          <button
            onClick={() => setActiveAdminTab('live')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
            Referral Links & Offers ({liveOffers.length})
          </button>

          <button
            onClick={() => setActiveAdminTab('pending')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'pending'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            CashBot Queue
            {pendingOffers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {pendingOffers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('create')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1 ${
              activeAdminTab === 'create'
                ? 'bg-white/10 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            New Custom Offer
          </button>

          <button
            onClick={() => setActiveAdminTab('blasts')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1 ${
              activeAdminTab === 'blasts'
                ? 'bg-white/10 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-[#00f2fe]" />
            Blast Logs ({blastLogs.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Pending CashBot Findings & Approval */}
      {activeAdminTab === 'pending' && (
        <div className="space-y-4">
          {pendingOffers.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-[#0b0e14] border border-white/[0.08]">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">CashBot Queue is Clear</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                No new pending offers. CashBot is scanning the web every hour. You can trigger an instant scan using the status widget on the home tab.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: List of pending findings */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Discovered by CashBot ({pendingOffers.length} awaiting review)
                </div>
                {pendingOffers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => handleSelectPending(offer)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedPendingId === offer.id
                        ? 'bg-[#141a26] border-amber-500/50 shadow-md'
                        : 'bg-[#0e121a] border-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CompanyLogo companyName={offer.company} slug={offer.companySlug} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono text-zinc-400 truncate">{offer.company}</div>
                        <div className="text-sm font-bold text-white truncate">{offer.title}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold shrink-0">
                        {offer.incentiveAmount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right Column: Review, attach referral code, approve with blast */}
              {selectedPendingOffer && (
                <div className="lg:col-span-2 p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-5">
                  <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div className="flex items-center gap-3">
                      <CompanyLogo companyName={selectedPendingOffer.company} slug={selectedPendingOffer.companySlug} size="md" />
                      <div>
                        <div className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          Pending CashBot Review
                        </div>
                        <h3 className="text-lg font-bold text-white mt-0.5">
                          {selectedPendingOffer.title}
                        </h3>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-sm">
                      {selectedPendingOffer.incentiveAmount}
                    </span>
                  </div>

                  {/* Form to insert owner referral code and URL */}
                  <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-amber-400" />
                        Attach Your Referral Code & Outbound Link
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Quick Preset:</span>
                        {USER_REFERRAL_PRESETS.map((p) => (
                          <button
                            key={p.company}
                            type="button"
                            onClick={() => {
                              setReferralCodeInput(p.code);
                              setReferralUrlInput(p.url);
                            }}
                            className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/10 text-[10px] font-mono text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                          >
                            {p.company} ({p.code})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono text-zinc-300 font-semibold mb-1">
                          YOUR AFFILIATE / REFERRAL CODE:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. YOURCODE2026 or fastcash"
                          value={referralCodeInput}
                          onChange={(e) => setReferralCodeInput(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400 font-semibold text-emerald-400"
                        />
                        <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                          Displayed for users to copy during registration.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-zinc-300 font-semibold mb-1">
                          YOUR PERSONAL REFERRAL LINK:
                        </label>
                        <input
                          type="url"
                          placeholder="https://merchant.com/join/YOURCODE"
                          value={referralUrlInput}
                          onChange={(e) => setReferralUrlInput(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                          The outbound destination when users click "Claim".
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Omni-AI Council Consensus Review */}
                  {selectedPendingOffer.aiCouncil && (
                    <div className="p-4 rounded-lg bg-[#070d18] border border-cyan-500/30 text-xs space-y-2">
                      <div className="font-mono font-semibold text-cyan-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-cyan-400" />
                          Omni-AI Council Evaluation ({selectedPendingOffer.aiCouncil.consensusScore}% Consensus)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                          {selectedPendingOffer.aiCouncil.unanimousApproval ? '5/5 Unanimous' : 'Consensus Approved'}
                        </span>
                      </div>
                      <p className="text-zinc-300 font-sans text-xs">
                        {selectedPendingOffer.aiCouncil.councilSummary}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-zinc-400">
                        <div className="p-1.5 rounded bg-black/40">
                          <span className="text-blue-400 block font-semibold">DeepSeek Math:</span>
                          <span className="text-zinc-300 text-[10px] truncate block">{selectedPendingOffer.aiCouncil.deepseekRoiEstimate}</span>
                        </div>
                        <div className="p-1.5 rounded bg-black/40">
                          <span className="text-amber-400 block font-semibold">LLaMA Catch:</span>
                          <span className="text-zinc-300 text-[10px] truncate block">Risk: {selectedPendingOffer.aiCouncil.llamaCatchRisk}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Honest Truth review */}
                  <div className="p-4 rounded-lg bg-[#07090e] border border-white/[0.06] text-xs space-y-2">
                    <div className="font-mono font-semibold text-zinc-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      CashBot Extracted Honest Truth & Catch:
                    </div>
                    <p className="text-zinc-300 font-sans">{selectedPendingOffer.honestTruth.summary}</p>
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200">
                      <strong className="font-mono text-[11px] block">THE CATCH:</strong>
                      {selectedPendingOffer.honestTruth.theCatch}
                    </div>
                  </div>

                  {/* Speedrun Hints Preview */}
                  <div className="p-4 rounded-lg bg-[#07090e] border border-white/[0.06] text-xs space-y-2">
                    <div className="font-mono font-semibold text-[#38bdf8] flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generated Step-by-Step Speedrun Hints:
                    </div>
                    <ol className="space-y-1.5 list-decimal list-inside text-zinc-300">
                      {selectedPendingOffer.speedrunHints.map((step) => (
                        <li key={step.step} className="font-sans">
                          {step.instruction}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Email & Push blast option */}
                  <div className="p-3.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="blast-checkbox"
                        checked={blastEmailCheckbox}
                        onChange={(e) => setBlastEmailCheckbox(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/20 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="blast-checkbox" className="text-xs font-sans text-zinc-200 cursor-pointer">
                        <strong className="font-mono text-emerald-400 block">
                          Broadcast alert blast to {subscribers.length} newsletter subscribers & send push notification
                        </strong>
                        Instantly notifies our user community of this newly verified opportunity.
                      </label>
                    </div>
                    <Send className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:block" />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => onRejectOffer(selectedPendingOffer.id)}
                      className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-mono text-red-400 transition-colors"
                    >
                      Reject Finding
                    </button>
                    <button
                      onClick={handleApprove}
                      className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs font-mono transition-all flex items-center gap-2 shadow-md active:scale-[0.98]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve & Publish to Live Site
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manage Live Offers & Referral Links */}
      {activeAdminTab === 'live' && (
        <div className="space-y-5">
          {/* Header & Referral Vault Banner */}
          <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-emerald-400" />
                  Your Referral Links & Live Offers ({liveOffers.length})
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Plug in your personal referral code and invite link for every offer on the site. When visitors click or copy, they will use your exact tracking parameters.
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full md:w-72 shrink-0">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={liveSearchFilter}
                  onChange={(e) => setLiveSearchFilter(e.target.value)}
                  placeholder="Filter offers by company, code..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#141824] border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Referral Vault Quick-Pill Bar */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Your Verified Referral Accounts:
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  Click any account to jump or filter
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {USER_REFERRAL_PRESETS.map((preset) => {
                  const isActiveInOffers = liveOffers.some((o) =>
                    preset.matchKeys.some((k) => o.company.toLowerCase().includes(k))
                  );
                  return (
                    <button
                      key={preset.company}
                      type="button"
                      onClick={() => setLiveSearchFilter(preset.company)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        liveSearchFilter === preset.company
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                          : 'bg-[#141824] border-white/[0.06] hover:border-white/20 text-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono text-white flex items-center justify-between">
                        <span>{preset.company}</span>
                        {isActiveInOffers && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active on live site" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-400 truncate mt-0.5 font-semibold">
                        {preset.code}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {preset.bonus}
                      </div>
                    </button>
                  );
                })}
              </div>
              {liveSearchFilter && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                  <span className="text-xs font-mono text-zinc-400">
                    Showing results for: <span className="text-white font-bold">"{liveSearchFilter}"</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLiveSearchFilter('')}
                    className="text-xs font-mono text-amber-400 hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Offers List with Dedicated In-Card Referral Editor */}
          <div className="space-y-4">
            {filteredLiveOffers.map((offer) => {
              const draftCode = draftCodes[offer.id] !== undefined ? draftCodes[offer.id] : (offer.referralCode || '');
              const draftUrl = draftUrls[offer.id] !== undefined ? draftUrls[offer.id] : (offer.referralUrl || '');
              const isSaved = !!savedSuccessIds[offer.id];
              const isCopied = copiedCodeId === offer.id;

              // Check if there is a preset for this offer
              const matchedPreset = USER_REFERRAL_PRESETS.find((p) =>
                p.matchKeys.some((k) => offer.company.toLowerCase().includes(k))
              );

              return (
                <div
                  key={offer.id}
                  className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] hover:border-white/[0.15] transition-all space-y-4"
                >
                  {/* Top Bar: Company info & tags */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <CompanyLogo companyName={offer.company} slug={offer.companySlug} size="md" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold font-mono text-white">{offer.company}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
                            {offer.incentiveAmount}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 text-[10px] font-mono uppercase">
                            {offer.category}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 text-[10px] font-mono">
                            {offer.difficulty}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xl">{offer.title}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {draftUrl && (
                        <a
                          href={draftUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open your referral link in a new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Test Link</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove "${offer.company}" from live offers?`)) {
                            onDeleteLiveOffer(offer.id);
                          }
                        }}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        title="Delete offer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Referral Code & Link Input Fields */}
                  <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        Referral Code & Tracking URL Configuration
                      </span>
                      {matchedPreset && (
                        <button
                          type="button"
                          onClick={() => handleApplyPresetToOffer(offer.id, matchedPreset)}
                          className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors underline cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          Apply {matchedPreset.company} Preset ({matchedPreset.code})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Referral Code Field */}
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                          Referral Code:
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={draftCode}
                            onChange={(e) => handleDraftCodeChange(offer.id, e.target.value)}
                            placeholder="e.g. fastcash, markwinters39"
                            className="w-full px-3 py-2 pr-9 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-emerald-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-400 font-semibold"
                          />
                          {draftCode && (
                            <button
                              type="button"
                              onClick={() => handleCopyCode(draftCode, offer.id)}
                              className="absolute right-2 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy code"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Referral URL Field */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                          Personal Referral / Affiliate Link (Destination URL):
                        </label>
                        <input
                          type="url"
                          value={draftUrl}
                          onChange={(e) => handleDraftUrlChange(offer.id, e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* Bottom action bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
                        <span>Clicks tracked: <strong className="text-white">{offer.clicksCount || 0}</strong></span>
                        <span>Estimated conversions: <strong className="text-emerald-400">{offer.conversionsCount || 0}</strong></span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveOfferReferral(offer)}
                        className={`px-4 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Saved to Live Site!</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save Link & Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredLiveOffers.length === 0 && (
              <div className="p-10 text-center rounded-xl bg-[#0e121a] border border-white/[0.08]">
                <p className="text-xs font-mono text-zinc-400">
                  No offers matched your filter "{liveSearchFilter}".
                </p>
                <button
                  type="button"
                  onClick={() => setLiveSearchFilter('')}
                  className="mt-2 text-xs font-mono text-emerald-400 hover:underline cursor-pointer"
                >
                  Show all {liveOffers.length} offers
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Create Custom Offer */}
      {activeAdminTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className="p-6 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
          <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            Add Custom Referral Offer
          </h3>
          <p className="text-xs text-zinc-400">
            Create an offer with your custom referral parameters, honest catch breakdown, and speedrun steps.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Company / Merchant Name:</label>
              <input
                type="text"
                required
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Discover Bank"
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Offer Headline / Title:</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. $100 Statement Credit with First Purchase"
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Incentive Badge:</label>
              <input
                type="text"
                value={newIncentive}
                onChange={(e) => setNewIncentive(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Category:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              >
                <option value="fintech">Banking & Fintech</option>
                <option value="brokerage">Brokerage & Stocks</option>
                <option value="cashback">Cashback & Shopping</option>
                <option value="crypto">Crypto & Web3</option>
                <option value="apps">Apps & Services</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Deposit / Spend Req:</label>
              <input
                type="text"
                value={newDeposit}
                onChange={(e) => setNewDeposit(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
          </div>

          {/* Referral Code & URL section */}
          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                Referral Parameters
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Insert preset:</span>
                {USER_REFERRAL_PRESETS.map((p) => (
                  <button
                    key={p.company}
                    type="button"
                    onClick={() => {
                      setNewCompany(p.company);
                      setNewRefCode(p.code);
                      setNewRefUrl(p.url);
                    }}
                    className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/10 text-[10px] font-mono text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  >
                    {p.company} ({p.code})
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1 font-semibold">Your Referral Code:</label>
                <input
                  type="text"
                  value={newRefCode}
                  onChange={(e) => setNewRefCode(e.target.value)}
                  placeholder="e.g. fastcash, markwinters39"
                  className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-emerald-400 font-semibold focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  The code visitors will copy and apply.
                </span>
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1 font-semibold">Your Referral URL:</label>
                <input
                  type="url"
                  value={newRefUrl}
                  onChange={(e) => setNewRefUrl(e.target.value)}
                  placeholder="https://merchant.com/r/..."
                  className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  The destination link opened when visitors click.
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1">The Catch & Fine Print (Honest Truth):</label>
            <textarea
              rows={2}
              value={newHonestCatch}
              onChange={(e) => setNewHonestCatch(e.target.value)}
              placeholder="State any deposit hold, card requirements, or cancellation reminders clearly."
              className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs transition-colors"
          >
            Publish Custom Offer to signups4fastcash.com
          </button>
        </form>
      )}

      {/* Tab 4: Email Blast & Notification Logs */}
      {activeAdminTab === 'blasts' && (
        <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-[#00f2fe]" />
              Newsletter & Push Broadcast History
            </h3>
            <span className="text-xs font-mono text-emerald-400">
              {subscribers.length} Active Subscribers
            </span>
          </div>

          {blastLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No blasts triggered yet. When you approve an offer with the blast option checked, dispatch logs will show here.
            </div>
          ) : (
            <div className="space-y-2.5">
              {blastLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-[#141824] border border-white/[0.06] text-xs font-mono flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold">{log.subject}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Sent to {log.recipientCount} subscribers • {new Date(log.sentAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                    Delivered
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
