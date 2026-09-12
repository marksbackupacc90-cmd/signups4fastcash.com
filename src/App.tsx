import React, { useEffect, useState } from 'react';
import { Offer, NewsletterSubscriber, EmailBlastLog } from './types';
import { PUBLIC_OFFERS, INITIAL_PENDING_OFFERS } from './data/initialOffers';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OfferCard } from './components/OfferCard';
import { AdminPanel } from './components/AdminPanel';
import { NewsletterModal } from './components/NewsletterModal';
import { Footer } from './components/Footer';
import { TrustAndFaq } from './components/TrustAndFaq';
import { SurveyRewardsPanel } from './components/SurveyRewardsPanel';
import { LegalModal } from './components/LegalModal';
import { SfcCoinLogo } from './components/SfcCoinLogo';
import { CheckCircle2 } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { AccountPanel } from './components/AccountPanel';

interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  paypalEmail?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  state?: string | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function payoutSortValue(payoutSpeed: string) {
  if (/instant|immediate/i.test(payoutSpeed)) return 0;
  const hours = payoutSpeed.match(/(\d+)(?:\s*-\s*\d+)?\s*hours?/i);
  if (hours) return Number(hours[1]);
  const days = payoutSpeed.match(/(\d+)(?:\s*-\s*\d+)?\s*business days?/i);
  return days ? Number(days[1]) * 24 : Number.MAX_SAFE_INTEGER;
}

function depositSortValue(depositRequired: string) {
  const amount = depositRequired.match(/\$(\d+(?:\.\d+)?)/);
  return amount ? Number(amount[1]) : Number.MAX_SAFE_INTEGER;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'offers' | 'surveys' | 'admin'>('offers');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('signups4fastcash_theme') === 'light' ? 'light' : 'dark'
  );

  const [liveOffers, setLiveOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('signups4fastcash_offers');
    if (saved) {
      try {
        const parsed: Offer[] = JSON.parse(saved);
        const existingIds = new Set(parsed.map((o) => o.id));
        const missing = PUBLIC_OFFERS.filter((o) => !existingIds.has(o.id));

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
      } catch (error) {
        console.error('Failed to parse saved offers', error);
      }
    }
    return PUBLIC_OFFERS;
  });

  const [pendingOffers, setPendingOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('signups4fastcash_pending');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Failed to parse saved pending', error);
      }
    }
    return INITIAL_PENDING_OFFERS;
  });

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [blastLogs, setBlastLogs] = useState<EmailBlastLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'highest' | 'fastest' | 'easiest'>('highest');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [legalSection, setLegalSection] = useState<'privacy' | 'terms' | 'affiliate' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authOpenRequest, setAuthOpenRequest] = useState(0);

  useEffect(() => {
    const storageKey = 'signups4fastcash_visitor_id';
    let visitorId = localStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(storageKey, visitorId);
    }
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source')
      ? `${params.get('utm_source')}:${params.get('utm_medium') || 'unknown'}`
      : document.referrer ? new URL(document.referrer).hostname : 'direct';
    void fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, path: window.location.pathname, source }),
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('signups4fastcash_theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.removeItem('signups4fastcash_admin_unlocked');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && !isAdminUnlocked) {
      setActiveTab('offers');
    }
  }, [activeTab, isAdminUnlocked]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 4000);
  };

  const getAdminHeaders = () => {
    const token = localStorage.getItem('signups4fastcash_admin_token');
    return token ? { 'x-admin-token': token } : {};
  };

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

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    try {
      localStorage.removeItem('signups4fastcash_admin_token');
    } catch {
      // ignore
    }
    setActiveTab('offers');
    showToast('Admin Panel locked and hidden.');
  };

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) {
      showToast('On desktop, use the browser install icon. On Android, choose Install app from Chrome’s menu. Google Play publishing requires a separate Android release.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') showToast('App installation started.');
    setInstallPrompt(null);
  };

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
    localStorage.setItem('signups4fastcash_pending', JSON.stringify(pendingOffers));
  }, [pendingOffers]);

  const safeShowNotification = (title: string, options?: NotificationOptions) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, options);
          return true;
        } catch {
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
      // gracefully fall back to toast alerts
    }
    return false;
  };

  const handleTogglePush = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setPushEnabled(true);
          showToast('Push notifications are active.');
        } else if (Notification.permission !== 'denied' && typeof Notification.requestPermission === 'function') {
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              setPushEnabled(true);
              showToast('Push notifications enabled.');
              safeShowNotification('Signups4FastCash.com alerts active', {
                body: 'New high-value offer alerts will appear here.',
                icon: '/favicon.ico',
              });
            } else {
              setPushEnabled(true);
              showToast('In-app notifications enabled for this session.');
            }
          } catch {
            setPushEnabled(true);
            showToast('In-app notifications enabled for this session.');
          }
        } else {
          setPushEnabled(true);
          showToast('In-app notifications enabled for this session.');
        }
      } else {
        setPushEnabled(true);
        showToast('Browser alerts enabled for this session.');
      }
    } catch {
      setPushEnabled(true);
      showToast('In-app notifications enabled for this session.');
    }
  };

  const handleClaimClick = async (offerId: string) => {
    setLiveOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, clicksCount: o.clicksCount + 1 } : o))
    );

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, type: 'click' }),
      });
    } catch {
      // telemetry fallback
    }
  };

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

    setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
    setLiveOffers((prev) => [approvedOffer, ...prev]);

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
        safeShowNotification(`New offer approved: ${approvedOffer.company}`, {
          body: `${approvedOffer.incentiveAmount} • ${approvedOffer.title}`,
          icon: '/favicon.ico',
        });
      }
      showToast('Offer published. Email delivery still requires a connected provider.');
    } else {
      showToast(`Approved & published ${approvedOffer.company} with your referral link.`);
    }

    setActiveTab('offers');
  };

  const handleRejectOffer = (offerId: string) => {
    setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
    showToast('Removed offer from the pending queue.');
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
    await fetch(`/api/offers/${offerId}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    }).catch(() => {});
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

    showToast(`Published ${fullOffer.company} to Signups4FastCash.com!`);
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
    } catch {
      // local fallback
    }

    showToast(`Subscribed ${email} to ${frequency} earning alerts.`);
  };

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
        return payoutSortValue(a.payoutSpeed) - payoutSortValue(b.payoutSpeed);
      }
      if (sortBy === 'easiest') {
        return depositSortValue(a.depositRequired) - depositSortValue(b.depositRequired);
      }
      return 0;
    });

  return (
    <div className={`retro-desktop min-h-screen flex flex-col font-sans antialiased selection:bg-blue-200 selection:text-black ${theme === 'light' ? 'light-mode' : ''}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onInstallApp={handleInstallApp}
        installAvailable={Boolean(installPrompt)}
        username={authUser?.username}
        onSignIn={() => setAuthOpenRequest((request) => request + 1)}
        onAccount={() => setAccountOpen(true)}
        onSignOut={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          setAuthUser(null);
          setAccountOpen(false);
        }}
      />

      {installPrompt && (
        <button
          onClick={async () => {
            await installPrompt.prompt();
            setInstallPrompt(null);
          }}
          className="fixed bottom-5 left-5 z-40 rounded-lg border border-cyan-400/30 bg-[#10141d] px-3 py-2 text-xs font-semibold text-cyan-200 shadow-xl hover:bg-cyan-400/10"
        >
          Install the app
        </button>
      )}

      <main className="flex-1">
        {activeTab === 'offers' && (
          <div aria-hidden="true" className="pointer-events-none fixed bottom-5 right-5 z-30 opacity-90">
            <SfcCoinLogo size="md" />
          </div>
        )}
        {activeTab === 'offers' && (
          <div>
            <Hero
              searchQuery={searchQuery}
              setSearchQuery={handleSearchChange}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              sortBy={sortBy}
              setSortBy={setSortBy}
              totalOffersCount={liveOffers.length}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="offers">
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

              {filteredOffers.length === 0 ? (
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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
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
            </div>

            <TrustAndFaq />
          </div>
        )}

        {activeTab === 'surveys' && (
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8" id="surveys">
            <SurveyRewardsPanel userId={authUser?.id} />
          </div>
        )}

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

      <NewsletterModal
        isOpen={isNewsletterOpen}
        onClose={() => setIsNewsletterOpen(false)}
        onSubscribe={handleSubscribeNewsletter}
        subscriberCount={subscribers.length}
      />

      <AuthModal user={authUser} onUserChange={setAuthUser} openRequest={authOpenRequest} />
      {accountOpen && authUser && (
        <AccountPanel user={authUser} onUserChange={setAuthUser} onClose={() => setAccountOpen(false)} />
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl bg-[#10141d] border border-[#00f2fe]/40 text-white text-xs font-mono shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-[#00f2fe]/10 text-[#00f2fe] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="max-w-xs">{toastMessage}</span>
        </div>
      )}

      <Footer
        onOpenNewsletter={() => setIsNewsletterOpen(true)}
        onTogglePush={handleTogglePush}
        pushEnabled={pushEnabled}
        onOpenLegal={setLegalSection}
        onSelectOffers={() => {
          setActiveTab('offers');
          window.setTimeout(() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth' }), 0);
        }}
        onSelectSurveys={() => {
          setActiveTab('surveys');
          window.setTimeout(() => document.getElementById('surveys')?.scrollIntoView({ behavior: 'smooth' }), 0);
        }}
        onSelectAdmin={() => {
          if (isAdminUnlocked) {
            setActiveTab('admin');
          }
        }}
        isAdminUnlocked={isAdminUnlocked}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />

      <LegalModal section={legalSection} onClose={() => setLegalSection(null)} />
    </div>
  );
}
