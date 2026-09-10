import React, { useState, useEffect } from 'react';
import { Offer, NewsletterSubscriber, EmailBlastLog } from './types';
import { PUBLIC_OFFERS, INITIAL_PENDING_OFFERS } from './data/initialOffers';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OfferCard } from './components/OfferCard';
import { AdminPanel } from './components/AdminPanel';
import { NewsletterModal } from './components/NewsletterModal';
import { Footer } from './components/Footer';
import { TrustAndFaq } from './components/TrustAndFaq';
import { LegalModal } from './components/LegalModal';
import { CheckCircle2 } from 'lucide-react';
import { SurveyRewardsPanel } from './components/SurveyRewardsPanel';
import { GamesPanel } from './components/GamesPanel';

export default function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'offers' | 'games' | 'analytics' | 'admin'>('offers');
  
  // Storage & Offers state
  const [liveOffers, setLiveOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('signups4fastcash_offers');
    if (saved) {
      try {
        const parsed: Offer[] = JSON.parse(saved);
        // Ensure new initial offers (Stake, Freecash, Capital One, AceBet) are included
        const existingIds = new Set(parsed.map((o) => o.id));
        const missing = PUBLIC_OFFERS.filter((o) => !existingIds.has(o.id));
        
        // Ensure user's updated referral codes & links are applied to existing offers
        const synced = parsed.map((o) => {
          if (o.company.toLowerCase().includes('sofi') && o.referralCode === 'SOFI-CASH2026') {
            return {
              ...o,
              referralCode: '72836365',
              referralUrl: 'https://www.sofi.com/invite/coach?gcp=72836365-7180-469f-bfe5-42d8c2578a99&isAliasGcp=false&siid=e2c1795c-e596-4927-a73f-cfe51c7ea3d7',
            };
          }
          if (o.company.toLowerCase().includes('chime') && o.referralCode === 'CHIME100FREE') {
            return {
              ...o,
              referralCode: 'markwinters39',
              referralUrl: 'https://www.chime.com/r/markwinters39/',
            };
          }
          return o;
        });

        return [...synced, ...missing];
      } catch (e) {
        console.error('Failed to parse saved offers', e);
      }
    }
    return PUBLIC_OFFERS;
  });

  const [pendingOffers, setPendingOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('signups4fastcash_pending');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved pending', e);
      }
    }
    return INITIAL_PENDING_OFFERS;
  });

  // Subscribers state
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);

  // Blast logs
  const [blastLogs, setBlastLogs] = useState<EmailBlastLog[]>([]);

  // UI Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'highest' | 'fastest' | 'easiest'>('highest');

  // Admin Secret Access State
  // Completely hidden by default until "207207207207207" is searched
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  // Clear any legacy localStorage unlock on mount so admin is always hidden on initial load
  useEffect(() => {
    try {
      localStorage.removeItem('signups4fastcash_admin_unlocked');
    } catch {
      // ignore
    }
  }, []);

  // Guard: If admin is locked, prevent activeTab from remaining on admin
  useEffect(() => {
    if (activeTab === 'admin' && !isAdminUnlocked) {
      setActiveTab('offers');
    }
  }, [activeTab, isAdminUnlocked]);

  // Admin access uses a server-configured passcode; no credential is embedded in the client.
  const handleSearchChange = async (query: string) => {
    const sanitized = query.replace(/\s+/g, '');
    if (sanitized.length >= 12) {
      const response = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: sanitized }),
      }).catch(() => null);
      if (response?.ok) {
        const data = await response.json() as { token: string };
        setIsAdminUnlocked(true);
        localStorage.setItem('signups4fastcash_admin_token', data.token);
        setSearchQuery('');
        setActiveTab('admin');
        showToast('Admin access enabled for this browser session.');
        return;
      }
    }
    setSearchQuery(query);
  };

  const getAdminHeaders = () => {
    const token = localStorage.getItem('signups4fastcash_admin_token');
    return token ? { 'x-admin-token': token } : {};
  };

  // Allow admin owner to re-lock and conceal admin controls
  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    try {
      localStorage.removeItem('signups4fastcash_admin_token');
    } catch (e) {
      // ignore
    }
    setActiveTab('offers');
    showToast('🔒 Admin Panel locked and hidden.');
  };

  // Modals & Push
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [legalSection, setLegalSection] = useState<'privacy' | 'terms' | 'affiliate' | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [cashOutOpen, setCashOutOpen] = useState(false);

  // Persist offers to localStorage
  useEffect(() => {
    localStorage.setItem('signups4fastcash_offers', JSON.stringify(liveOffers));
  }, [liveOffers]);

  useEffect(() => {
    fetch('/api/offers')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load offers'))))
      .then((data: { offers: Offer[] }) => setLiveOffers(data.offers))
      .catch(() => {
        // Keep the local catalog available when the API is offline.
      });
  }, []);

  useEffect(() => {
    const storageKey = 'signups4fastcash_survey_user_id';
    const userId = localStorage.getItem(storageKey);
    if (!userId) return;
    fetch(`/api/cpx/balance?user_id=${encodeURIComponent(userId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { points?: number } | null) => {
        if (data?.points !== undefined) setRewardPoints(data.points);
      })
      .catch(() => undefined);
  }, [selectedCategory]);

  useEffect(() => {
    localStorage.setItem('signups4fastcash_pending', JSON.stringify(pendingOffers));
  }, [pendingOffers]);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Safe browser notification dispatcher (prevents "TypeError: Illegal constructor" in iframes & Chromium mobile)
  const safeShowNotification = (title: string, options?: NotificationOptions) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, options);
          return true;
        } catch {
          // Fallback: In sandboxed iframes or Chrome Android, new Notification() is an illegal constructor.
          if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready
              .then((registration) => {
                registration.showNotification(title, options).catch(() => {});
              })
              .catch(() => {});
          }
        }
      }
    } catch {
      // Gracefully fall back to in-app toast alerts
    }
    return false;
  };

  // Push notification toggle with browser permission integration
  const handleTogglePush = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setPushEnabled(true);
          showToast('🔔 Push notifications are active! You will receive new drop alerts.');
        } else if (Notification.permission !== 'denied' && typeof Notification.requestPermission === 'function') {
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              setPushEnabled(true);
              showToast('🔔 Push notifications enabled! Alerts will sound on high-yield drops.');
              safeShowNotification('signups4fastcash.com Alerts Active', {
                body: 'You are now connected to CashBot instant verified referral drops!',
                icon: '/favicon.ico',
              });
            } else {
              setPushEnabled(true); // in-app virtual fallback
              showToast('🔔 In-app push notifications enabled for this session.');
            }
          } catch {
            setPushEnabled(true);
            showToast('🔔 In-app push notifications enabled for this session.');
          }
        } else {
          setPushEnabled(true);
          showToast('🔔 In-app notifications active for this session.');
        }
      } else {
        setPushEnabled(true);
        showToast('🔔 Push alert subscription enabled for your browser session.');
      }
    } catch {
      setPushEnabled(true);
      showToast('🔔 In-app push notifications enabled for this session.');
    }
  };

  // Click tracking handler
  const handleClaimClick = async (offerId: string) => {
    setLiveOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, clicksCount: o.clicksCount + 1 } : o))
    );

    // Track with backend
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, type: 'click' }),
      });
    } catch (e) {
      // client-side telemetry fallback
    }
  };

  // Admin approves offer & optionally sends email blast + push
  const handleApproveOffer = (
    offerId: string,
    referralCode: string,
    referralUrl: string,
    blastEmail: boolean
  ) => {
    const offerToApprove = pendingOffers.find((o) => o.id === offerId);
    if (!offerToApprove) return;

    const approvedOffer: Offer = {
      ...offerToApprove,
      referralCode,
      referralUrl,
      status: 'live',
      updatedAt: new Date().toISOString(),
    };

    // Remove from pending
    setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
    // Add to live
    setLiveOffers((prev) => [approvedOffer, ...prev]);

    // Handle newsletter blast & push notification
    if (blastEmail) {
      const newBlast: EmailBlastLog = {
        id: `blast-${Date.now()}`,
        offerId: approvedOffer.id,
        offerTitle: `${approvedOffer.company} - ${approvedOffer.title}`,
        sentAt: new Date().toISOString(),
        recipientCount: subscribers.length,
        subject: `New offer listed: ${approvedOffer.incentiveAmount} on ${approvedOffer.company}`,
        pushSent: pushEnabled,
      };
      setBlastLogs((prev) => [newBlast, ...prev]);

      if (pushEnabled) {
        safeShowNotification(`New Bonus Approved: ${approvedOffer.company}`, {
          body: `${approvedOffer.incentiveAmount} • ${approvedOffer.title}`,
          icon: '/favicon.ico',
        });
      }
      showToast(`Offer published. Email delivery still requires a connected provider.`);
    } else {
      showToast(`✅ Approved & published ${approvedOffer.company} with your referral link.`);
    }

    setActiveTab('offers');
  };

  const handleRejectOffer = (offerId: string) => {
    setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
    showToast('Removed offer from CashBot pending queue.');
  };

  const handleUpdateLiveOffer = async (offerId: string, updates: Partial<Offer>) => {
    const previousOffers = liveOffers;
    setLiveOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o))
    );
    const response = await fetch(`/api/offers/${offerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify(updates),
    }).catch(() => null);
    if (!response?.ok) {
      setLiveOffers(previousOffers);
      const message = response ? await response.json().catch(() => null) : null;
      showToast(message?.error || 'Could not save the offer. Check the referral URL and try again.');
      return;
    }
    showToast('Updated live referral parameters.');
  };

  const handleDeleteLiveOffer = async (offerId: string) => {
    setLiveOffers((prev) => prev.filter((o) => o.id !== offerId));
    await fetch(`/api/offers/${offerId}`, { method: 'DELETE', headers: getAdminHeaders() }).catch(() => {});
    showToast('Offer removed from live site.');
  };

  const handleCreateCustomOffer = async (
    newOfferData: Omit<Offer, 'id' | 'clicksCount' | 'conversionsCount' | 'createdAt' | 'updatedAt'>
  ) => {
    const fullOffer: Offer = {
      ...newOfferData,
      id: `custom-${Date.now()}`,
      clicksCount: 0,
      conversionsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLiveOffers((prev) => [fullOffer, ...prev]);
    const response = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify(fullOffer),
    }).catch(() => null);
    if (!response?.ok) {
      setLiveOffers((prev) => prev.filter((offer) => offer.id !== fullOffer.id));
      const message = response ? await response.json().catch(() => null) : null;
      showToast(message?.error || 'Could not publish the offer. Check the merchant and referral URLs.');
      return;
    }
    showToast(`Published ${fullOffer.company} to signups4fastcash.com!`);
  };

  const handleSubscribeNewsletter = async (email: string, frequency: 'instant' | 'daily' | 'weekly') => {
    const newSub: NewsletterSubscriber = {
      id: `sub-${Date.now()}`,
      email,
      subscribedAt: new Date().toISOString(),
      verified: true,
      frequency,
    };
    setSubscribers((prev) => [newSub, ...prev]);

    try {
      await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency }),
      });
    } catch (e) {
      // local fallback
    }

    showToast(`🎉 Subscribed ${email} to ${frequency} earning alerts!`);
  };

  const handleSelectOfferFromCouncil = (offerId: string) => {
    setActiveTab('offers');
    setSelectedCategory('all');
    setSearchQuery('');
    setTimeout(() => {
      const el = document.getElementById(`offer-card-${offerId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-cyan-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 3000);
      }
    }, 150);
  };

  const handleSelectSurveys = () => {
    setActiveTab('offers');
    setSelectedCategory('surveys');
    setSearchQuery('');
    setTimeout(() => {
      document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  // Filter and Sort Logic
  const filteredOffers = liveOffers
    .filter((offer) => {
      if (selectedCategory !== 'all' && offer.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          offer.company.toLowerCase().includes(q) ||
          offer.title.toLowerCase().includes(q) ||
          offer.incentiveAmount.toLowerCase().includes(q) ||
          offer.depositRequired.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') {
        return b.incentiveValue - a.incentiveValue;
      }
      if (sortBy === 'fastest') {
        return a.difficulty.localeCompare(b.difficulty);
      }
      if (sortBy === 'easiest') {
        return a.depositRequired.localeCompare(b.depositRequired);
      }
      return 0;
    });

  return (
    <div className="min-h-screen flex flex-col bg-[#090b0e] text-[#ededed] font-sans antialiased selection:bg-[#00f2fe]/20 selection:text-[#00f2fe]">
      
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectSurveys={handleSelectSurveys}
        rewardPoints={rewardPoints}
        onCashOut={() => setCashOutOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* View 1: Main Offers Discovery (Default) */}
        {activeTab === 'offers' && (
          <div>
            {/* Hero & Filters */}
            <Hero
              searchQuery={searchQuery}
              setSearchQuery={handleSearchChange}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              sortBy={sortBy}
              setSortBy={setSortBy}
              totalOffersCount={liveOffers.length}
            />

            {/* Container for CashBot Status & Offers List */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="offers">
              
              {/* Offers Grid */}
              <div>
                {selectedCategory === 'surveys' && <SurveyRewardsPanel />}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                      Available Offers ({filteredOffers.length})
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
                    Requirements and availability can change on the merchant site
                  </span>
                </div>

                {filteredOffers.length === 0 && selectedCategory !== 'surveys' ? (
                  <div className="p-12 text-center rounded-xl bg-[#0e121a] border border-white/[0.08]">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                      $
                    </div>
                    <h3 className="text-base font-bold text-white">No Matching Offers Found</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                      Try adjusting your search keywords or switching category filters to see all available referral signups.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                      }}
                      className="mt-4 px-3 py-1.5 rounded bg-white/10 text-xs font-mono text-white hover:bg-white/20"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-5">
                    {filteredOffers.map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        onClaimClick={handleClaimClick}
                      />
                    ))}
                  </div>
                )}

              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-y border-white/[0.08] py-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Get new high-value offers by email</h3>
                  <p className="text-xs text-zinc-500 mt-1">One useful alert at a time. No daily noise.</p>
                </div>
                <button
                  onClick={() => setIsNewsletterOpen(true)}
                  className="px-3 py-2 rounded-lg bg-white text-black hover:bg-cyan-100 font-semibold text-xs transition-colors"
                >
                  Subscribe to alerts
                </button>
              </div>

              <TrustAndFaq />

            </div>
          </div>
        )}

        {activeTab === 'games' && <GamesPanel />}

        {/* Admin Panel */}
        {activeTab === 'admin' && isAdminUnlocked && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <AdminPanel
              pendingOffers={pendingOffers}
              liveOffers={liveOffers}
              subscribers={subscribers}
              onApproveOffer={handleApproveOffer}
              onRejectOffer={handleRejectOffer}
              onUpdateLiveOffer={handleUpdateLiveOffer}
              onDeleteLiveOffer={handleDeleteLiveOffer}
              onCreateCustomOffer={handleCreateCustomOffer}
              blastLogs={blastLogs}
              onLockAdmin={handleLockAdmin}
            />
          </div>
        )}

      </main>

      {/* Modals */}
      <NewsletterModal
        isOpen={isNewsletterOpen}
        onClose={() => setIsNewsletterOpen(false)}
        onSubscribe={handleSubscribeNewsletter}
        subscriberCount={subscribers.length}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl bg-[#10141d] border border-[#00f2fe]/40 text-white text-xs font-mono shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-[#00f2fe]/10 text-[#00f2fe] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="max-w-xs">{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <Footer
        onOpenNewsletter={() => setIsNewsletterOpen(true)}
        onTogglePush={handleTogglePush}
        pushEnabled={pushEnabled}
        onOpenLegal={setLegalSection}
        onSelectAdmin={() => {
          if (isAdminUnlocked) {
            setActiveTab('admin');
          }
        }}
        onSelectSurveys={handleSelectSurveys}
        onSelectGames={() => {
          setActiveTab('games');
          setTimeout(() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
        }}
        isAdminUnlocked={isAdminUnlocked}
      />

      <LegalModal section={legalSection} onClose={() => setLegalSection(null)} />

      {cashOutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#10141d] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-emerald-300">PayPal cash out</p>
                <h2 className="mt-1 text-lg font-bold text-white">Cash-out setup is coming next</h2>
              </div>
              <button onClick={() => setCashOutOpen(false)} className="text-zinc-400 hover:text-white" aria-label="Close cash-out dialog">×</button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Your balance is tracked at 100 points per $1. The current minimum is $5 (500 points).
              Cash-out requests will require a verified account, a verified PayPal email, and fraud/reversal review.
            </p>
            <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">
              Google login and phone verification are not enabled yet. Do not enter a PayPal email or phone number until authenticated accounts and payout processing are live.
            </div>
            <button onClick={() => setCashOutOpen(false)} className="mt-5 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
              Got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
