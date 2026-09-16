import React, { useEffect, useState } from 'react';
import { Offer, NewsletterSubscriber, EmailBlastLog, SiteSettings, DEFAULT_SITE_SETTINGS } from './types';
import { PUBLIC_OFFERS, INITIAL_PENDING_OFFERS } from './data/initialOffers';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OfferCard } from './components/OfferCard';
import { AdminPanel } from './components/AdminPanel';
import { NewsletterModal } from './components/NewsletterModal';
import { Footer } from './components/Footer';
import { TrustAndFaq } from './components/TrustAndFaq';
import { LegalModal } from './components/LegalModal';
import { SfcCoinLogo } from './components/SfcCoinLogo';
import { CheckCircle2 } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { AccountPanel } from './components/AccountPanel';
import { OfferFinder } from './components/OfferFinder';
import { CommunityChat } from './components/CommunityChat';
import { HowItWorks } from './components/HowItWorks';

interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  avatarUrl?: string | null;
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

function isAvailableOffer(offer: Offer) {
  return String(offer.category) !== 'surveys';
}

export default function App() {
  const recordingMode = new URLSearchParams(window.location.search).get('recording') === '1';
  const [activeTab, setActiveTab] = useState<'offers' | 'admin'>('offers');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('signups4fastcash_theme') === 'light' ? 'light' : 'dark'
  );

  const [liveOffers, setLiveOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('signups4fastcash_offers');
    if (saved) {
      try {
        const parsed: Offer[] = JSON.parse(saved);
        const availableOffers = parsed.filter(isAvailableOffer).map((offer) => {
          if (offer.company.toLowerCase().includes('sofi') && offer.referralCode === 'SOFI-CASH2026') {
            return {
              ...offer,
              referralCode: '72836365',
              referralUrl: 'https://www.sofi.com/invite/coach?gcp=72836365-7180-469f-bfe5-42d8c2578a99&isAliasGcp=false&siid=e2c1795c-e596-4927-a73f-cfe51c7ea3d7',
            };
          }
          if (offer.company.toLowerCase().includes('chime') && offer.referralCode === 'CHIME100FREE') {
            return {
              ...offer,
              referralCode: 'markwinters39',
              referralUrl: 'https://www.chime.com/r/markwinters39/',
            };
          }
          return offer;
        });

        const catalogMap = new Map(PUBLIC_OFFERS.map((offer) => [offer.id, offer]));
        const merged = PUBLIC_OFFERS.map((offer) => {
          const savedOffer = availableOffers.find((item) => item.id === offer.id);
          return {
            ...offer,
            ...(savedOffer || {}),
            clicksCount: Number.isFinite(Number(savedOffer?.clicksCount)) ? Number(savedOffer.clicksCount) : (offer.clicksCount ?? 0),
            conversionsCount: Number.isFinite(Number(savedOffer?.conversionsCount)) ? Number(savedOffer.conversionsCount) : (offer.conversionsCount ?? 0),
          };
        });

        return [...merged, ...availableOffers.filter((offer) => !catalogMap.has(offer.id))];
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
  const [isOwnerAdmin, setIsOwnerAdmin] = useState(false);
  const [adminUsernames, setAdminUsernames] = useState<string[]>([]);
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [legalSection, setLegalSection] = useState<'privacy' | 'terms' | 'affiliate' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authOpenRequest, setAuthOpenRequest] = useState(0);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [shareCopied, setShareCopied] = useState(false);
  const [offerFinderOpen, setOfferFinderOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    fetch('/api/site-settings')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load site settings'))))
      .then((data: { settings?: SiteSettings }) => {
        if (data.settings) setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...data.settings });
      })
      .catch(() => {
        setSiteSettings(DEFAULT_SITE_SETTINGS);
      });
  }, []);

  useEffect(() => {
    const rootTitle = siteSettings.metaTitle || DEFAULT_SITE_SETTINGS.metaTitle;
    document.title = rootTitle;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = siteSettings.metaDescription || DEFAULT_SITE_SETTINGS.metaDescription;
  }, [siteSettings]);

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
      headers: {
        'Content-Type': 'application/json',
        ...(() => {
          const token = localStorage.getItem('signups4fastcash_admin_token');
          return token ? { 'x-admin-token': token } : {};
        })(),
      },
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (!authUser) {
      setCanAccessAdmin(false);
      return;
    }

    fetch('/api/admin/can-access')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not check admin access'))))
      .then((data: { canAccess?: boolean }) => setCanAccessAdmin(Boolean(data.canAccess)))
      .catch(() => setCanAccessAdmin(false));
  }, [authUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 4000);
  };

  const getAdminHeaders = () => {
    const token = localStorage.getItem('signups4fastcash_admin_token');
    return token ? { 'x-admin-token': token } : {};
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const loadAdminUsernames = async (token?: string) => {
    const response = await fetch('/api/admin/access', {
      headers: { 'x-admin-token': token || localStorage.getItem('signups4fastcash_admin_token') || '' },
    });
    if (!response.ok) return;
    const data = await response.json() as { usernames?: string[] };
    setAdminUsernames(data.usernames || []);
  };

  const handleDelegatedAdminAccess = async () => {
    if (!authUser) {
      showToast('Sign in first to use delegated admin access.');
      setAuthMode('signin');
      setAuthOpenRequest((request) => request + 1);
      return;
    }
    const response = await fetch('/api/admin/unlock-user', { method: 'POST' }).catch(() => null);
    if (!response?.ok) {
      const data = await response?.json().catch(() => null) as { error?: string } | null;
      showToast(data?.error || 'This account does not have admin access.');
      return;
    }
    const data = await response.json() as { token: string; role?: 'owner' | 'delegated' };
    localStorage.setItem('signups4fastcash_admin_token', data.token);
    setIsAdminUnlocked(true);
    setIsOwnerAdmin(data.role === 'owner');
    setActiveTab('admin');
    if (data.role === 'owner') void loadAdminUsernames(data.token);
    showToast(data.role === 'owner' ? 'Owner admin access enabled.' : 'Delegated admin access enabled.');
  };

  const handleUpdateAdminUsernames = async (usernames: string[]) => {
    const response = await fetch('/api/admin/access', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify({ usernames }),
    });
    const data = await response.json().catch(() => null) as { usernames?: string[]; error?: string } | null;
    if (!response.ok) {
      showToast(data?.error || 'Could not update admin access.');
      return;
    }
    setAdminUsernames(data?.usernames || []);
    showToast('Delegated admin access updated.');
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    setIsOwnerAdmin(false);
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
      .then((data: { offers: Offer[] }) => setLiveOffers(data.offers.filter(isAvailableOffer)))
      .catch(() => {
        // Keep the local catalog available when the API is offline.
      });
  }, []);

  useEffect(() => {
    if (activeTab !== 'admin') return;

    const refreshOffers = () => {
      fetch('/api/offers')
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to refresh offers'))))
        .then((data: { offers: Offer[] }) => setLiveOffers(data.offers.filter(isAvailableOffer)))
        .catch(() => {
          // Keep the current admin counts available when the API is temporarily offline.
        });
    };

    refreshOffers();
    const intervalId = window.setInterval(refreshOffers, 10000);
    window.addEventListener('focus', refreshOffers);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOffers);
    };
  }, [activeTab]);

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
    const adminToken = localStorage.getItem('signups4fastcash_admin_token');
    if (adminToken) return;

    setLiveOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, clicksCount: o.clicksCount + 1 } : o))
    );

    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, type: 'click' }),
      });
      if (response.ok) {
        const data = await response.json() as {
          offer?: { id: string; clicksCount: number; conversionsCount: number };
        };
        if (data.offer?.id === offerId) {
          setLiveOffers((prev) =>
            prev.map((offer) =>
              offer.id === offerId
                ? {
                    ...offer,
                    clicksCount: data.offer?.clicksCount ?? offer.clicksCount,
                    conversionsCount: data.offer?.conversionsCount ?? offer.conversionsCount,
                  }
                : offer
            )
          );
        }
      }
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

  const orderedLiveOffers = [...liveOffers].sort((a, b) => {
    if (Number(b.featured ?? false) !== Number(a.featured ?? false)) {
      return Number(b.featured ?? false) - Number(a.featured ?? false);
    }
    return b.incentiveValue - a.incentiveValue;
  });

  const filteredOffers = orderedLiveOffers
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

  const shareUrl = 'https://signups4fastcash.com/?utm_source=visitor_share&utm_medium=referral&utm_campaign=share_cta';
  const shareMessage = `I found a comparison site for signup bonuses, cashback, and no-deposit offers. It shows the requirements and fine print before you click: ${shareUrl}`;
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Signup bonuses and no-deposit offers', text: shareMessage, url: shareUrl });
      return;
    }
    await navigator.clipboard.writeText(shareMessage);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2500);
  };
  const handleFinderOffer = (offer: Offer) => {
    setOfferFinderOpen(false);
    setSearchQuery(offer.company);
    window.setTimeout(() => document.getElementById(`offer-card-${offer.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const handleUpdateSiteSettings = async (updates: Partial<SiteSettings>) => {
    const next = { ...siteSettings, ...updates };
    setSiteSettings(next);
    const response = await fetch('/api/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      setSiteSettings(siteSettings);
      showToast('Could not save changes. Please try again.');
      return;
    }
    const data = await response.json() as { settings?: SiteSettings };
    if (data.settings) setSiteSettings(data.settings);
    showToast('Changes saved successfully.');
  };

  return (
    <div
      data-site-theme="custom"
      style={{
        '--site-background': siteSettings.themeBackgroundColor,
        '--site-accent': siteSettings.themeAccentColor,
        '--site-panel': siteSettings.themePanelColor,
      } as React.CSSProperties}
      className={`retro-desktop min-h-screen flex flex-col font-sans antialiased selection:bg-blue-200 selection:text-black ${theme === 'light' ? 'light-mode' : ''}`}
    >
      <Navbar
        siteSettings={siteSettings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onInstallApp={handleInstallApp}
        installAvailable={Boolean(installPrompt)}
        username={authUser?.username}
        userId={authUser?.id}
        onShare={() => void handleShare()}
        shareCopied={shareCopied}
        onOpenFinder={() => setOfferFinderOpen(true)}
        onOpenNewsletter={() => setIsNewsletterOpen(true)}
        onSignUp={() => {
          setAuthMode('signup');
          setAuthOpenRequest((request) => request + 1);
        }}
        onSignIn={() => {
          setAuthMode('signin');
          setAuthOpenRequest((request) => request + 1);
        }}
        hideSignIn={recordingMode}
        onAccount={() => setAccountOpen(true)}
        onSignOut={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          setAuthUser(null);
          setAccountOpen(false);
          handleLockAdmin();
        }}
        onAdminAccess={() => void handleDelegatedAdminAccess()}
        canAccessAdmin={isAdminUnlocked || canAccessAdmin}
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
        {!authUser ? (
          <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-16 text-center">
            <div className="rounded-2xl border border-[#8bd3a7]/25 bg-[#14251f] p-8 shadow-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#8bd3a7]/25 bg-[#8bd3a7]/10 text-[#8bd3a7]">
                <SfcCoinLogo />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-white">Create an account to view offers</h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Sign in or create your free account to compare offers, save your preferences, and access the full site.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthOpenRequest((request) => request + 1);
                }}
                className="mt-6 rounded-lg border border-[#9b7650]/60 bg-[#6eae89] px-5 py-2.5 text-sm font-semibold text-[#102018] hover:bg-[#8bd3a7]"
              >
                Create free account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthOpenRequest((request) => request + 1);
                }}
                className="mt-3 block w-full text-xs font-semibold text-[#8bd3a7] hover:text-white"
              >
                Already have an account? Sign in
              </button>
            </div>
          </section>
        ) : activeTab === 'offers' && (
          <>
            <CommunityChat username={authUser?.username} userId={authUser?.id} />
          </>
        )}
        {activeTab === 'offers' && (
          <div>
            <Hero
              siteSettings={siteSettings}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearchSubmit={handleSearchChange}
              onOpenFinder={() => setOfferFinderOpen(true)}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              sortBy={sortBy}
              setSortBy={setSortBy}
              totalOffersCount={liveOffers.length}
              featuredOffers={orderedLiveOffers.slice(0, 4)}
            />

            <div className="mx-auto max-w-7xl space-y-4 px-4 pb-7 sm:px-6 lg:px-8" id="offers">
              <HowItWorks />
              <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] px-4 py-3 text-xs leading-relaxed text-zinc-300">
                <span className="font-semibold text-[#8ad7f5]">Affiliate disclosure:</span>{' '}
                Some links below are referral or affiliate links. If you use one, the merchant may compensate
                Signups4FastCash.com at no extra cost to you. We still show the requirements, risks, and fine print
                so you can compare offers before applying.
              </div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold uppercase tracking-wider text-[#f1e6cf]" aria-live="polite">
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
                <div className="mx-auto max-w-6xl">
                  <div className="grid gap-3">
                    {filteredOffers.map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        onClaimClick={handleClaimClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <TrustAndFaq siteSettings={siteSettings} />
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
              siteSettings={siteSettings}
              onUpdateSiteSettings={handleUpdateSiteSettings}
              isOwnerAdmin={isOwnerAdmin}
              adminUsernames={adminUsernames}
              onUpdateAdminUsernames={handleUpdateAdminUsernames}
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

      <AuthModal user={authUser} onUserChange={setAuthUser} openRequest={authOpenRequest} mode={authMode} disabled={recordingMode} requiredAuth={!authUser} />
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
        siteSettings={siteSettings}
        onOpenNewsletter={() => setIsNewsletterOpen(true)}
        onTogglePush={handleTogglePush}
        pushEnabled={pushEnabled}
        onOpenLegal={setLegalSection}
        onSelectOffers={() => {
          setActiveTab('offers');
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
      {offerFinderOpen && <OfferFinder offers={liveOffers} onViewOffer={handleFinderOffer} onClose={() => setOfferFinderOpen(false)} />}
    </div>
  );
}
