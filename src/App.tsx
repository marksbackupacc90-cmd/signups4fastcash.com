import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Offer, NewsletterSubscriber, EmailBlastLog, SiteSettings, DEFAULT_SITE_SETTINGS } from './types';
import { PUBLIC_OFFERS, INITIAL_PENDING_OFFERS } from './data/initialOffers';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OfferCard } from './components/OfferCard';
import { AdminDashboard } from './components/AdminDashboard';
import { NewsletterModal } from './components/NewsletterModal';
import { Footer } from './components/Footer';
import { TrustAndFaq } from './components/TrustAndFaq';
import { LegalModal, LegalSection } from './components/LegalModal';
import { SfcCoinLogo } from './components/SfcCoinLogo';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { AccountPanel } from './components/AccountPanel';
import { OfferFinder } from './components/OfferFinder';
import { CommunityChat } from './components/CommunityChat';
import { HowItWorks } from './components/HowItWorks';
import { CashBlueprint } from './components/CashBlueprint';
import { MyOffers, MyOfferStatus, readMyOfferEntries } from './components/MyOffers';

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

function shuffleOfferIds(offers: Offer[]) {
  return [...offers]
    .sort(() => Math.random() - 0.5)
    .map((offer) => offer.id);
}

export default function App() {
  const recordingMode = new URLSearchParams(window.location.search).get('recording') === '1';
  const [activeTab, setActiveTab] = useState<'offers' | 'daily' | 'admin'>('offers');
  const [liveOffers, setLiveOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('signups4fastcash_offers');
    if (saved) {
      try {
        const parsed: Offer[] = JSON.parse(saved);
        const availableOffers = parsed.filter(isAvailableOffer).map((offer) => {
          if (offer.company.toLowerCase().includes('sofi') && (
            offer.referralCode === 'SOFI-CASH2026' ||
            offer.referralCode === '72836365' ||
            offer.referralUrl?.includes('gcp=72836365')
          )) {
            return {
              ...offer,
              referralCode: undefined,
              referralUrl: 'https://www.sofi.com/invite/money?gcp=a8ea63bc-051c-47d9-ad8b-7ca79033c0cf&isAliasGcp=false&siid=7e2e4d1d-73bd-4626-aab3-483b313a07e9',
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
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [blastLogs, setBlastLogs] = useState<EmailBlastLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'random' | 'highest' | 'fastest' | 'easiest'>('random');
  const [randomOfferOrder, setRandomOfferOrder] = useState<string[]>(() => shuffleOfferIds(liveOffers));
  const [offerFilter, setOfferFilter] = useState<'all' | 'no-deposit' | 'paypal' | 'fast' | 'beginner' | 'purchase'>('all');
  const recordedImpressions = useRef(new Set<string>());
  const offersCarouselRef = useRef<HTMLDivElement | null>(null);
  const carouselDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  const [adminSection, setAdminSection] = useState<'live' | 'blasts'>('live');
  const [isOwnerAdmin, setIsOwnerAdmin] = useState(false);
  const [adminUsernames, setAdminUsernames] = useState<string[]>([]);
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [legalSection, setLegalSection] = useState<LegalSection | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [myOffersOpen, setMyOffersOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [messageNotification, setMessageNotification] = useState<{ count: number; preview: string } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authOpenRequest, setAuthOpenRequest] = useState(0);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [shareCopied, setShareCopied] = useState(false);
  const [offerFinderOpen, setOfferFinderOpen] = useState(false);
  const publicOffers = useMemo(() => liveOffers.filter((offer) => offer.status === 'live'), [liveOffers]);
  const [myOfferIds, setMyOfferIds] = useState<string[]>(() => readMyOfferEntries().map((entry) => entry.offerId));
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [analyticsConsent, setAnalyticsConsent] = useState<'unknown' | 'granted' | 'denied'>(() => {
    try {
      const saved = localStorage.getItem('signups4fastcash_analytics_consent');
      return saved === 'granted' || saved === 'denied' ? saved : 'unknown';
    } catch {
      return 'unknown';
    }
  });
  const liveOfferIds = liveOffers.map((offer) => offer.id).join('|');

  useEffect(() => {
    if (!authUser) {
      setMessageNotification(null);
      return;
    }
    const storageKey = `s4fc_last_message_check_${authUser.id}`;
    const initialSince = localStorage.getItem(storageKey) || new Date().toISOString();
    let since = initialSince;
    let cancelled = false;
    const notify = (messages: Array<{ content?: string }>) => {
      if (!messages.length || cancelled) return;
      const preview = messages[0]?.content || 'You received a new message.';
      setMessageNotification({ count: messages.length, preview });
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.08, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.25);
        }
      } catch {
        // Browser audio permissions may block notification sounds.
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New message', { body: preview });
      }
    };
    const checkMessages = async () => {
      const response = await fetch(`/api/direct-messages/notifications?since=${encodeURIComponent(since)}`, { cache: 'no-store' }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => null) as { messages?: Array<{ content?: string; created_at?: string }> } | null;
      const messages = Array.isArray(data?.messages) ? data.messages : [];
      if (messages.length) {
        notify(messages);
        since = messages[messages.length - 1].created_at || new Date().toISOString();
        localStorage.setItem(storageKey, since);
      } else {
        localStorage.setItem(storageKey, since);
      }
    };
    const timer = window.setInterval(() => void checkMessages(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authUser?.id]);

  useEffect(() => {
    setRandomOfferOrder((current) => {
      const currentIds = new Set(current);
      const unchanged = liveOffers.length === current.length && liveOffers.every((offer) => currentIds.has(offer.id));
      return unchanged ? current : shuffleOfferIds(liveOffers);
    });
  }, [liveOfferIds]);

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
    if (analyticsConsent !== 'granted') return;
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
  }, [analyticsConsent]);

  const updateAnalyticsConsent = (consent: 'granted' | 'denied') => {
    try {
      localStorage.setItem('signups4fastcash_analytics_consent', consent);
    } catch {
      // Continue with the in-memory choice if storage is unavailable.
    }
    setAnalyticsConsent(consent);
  };

  useEffect(() => {
    try {
      localStorage.removeItem('signups4fastcash_admin_unlocked');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const reportError = (event: ErrorEvent) => {
      void fetch('/api/telemetry/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: event.message || 'Unknown frontend error', path: window.location.pathname }),
      }).catch(() => {});
    };
    window.addEventListener('error', reportError);
    return () => window.removeEventListener('error', reportError);
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
      .then((data: { canAccess?: boolean }) => {
        setCanAccessAdmin(Boolean(data.canAccess));
      })
      .catch(() => setCanAccessAdmin(false));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    fetch('/api/account/offer-entries')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load saved offers')))
      .then(async (data: { entries?: { offerId: string; status: MyOfferStatus; updatedAt: string }[] }) => {
        const accountEntries = Array.isArray(data.entries) ? data.entries : [];
        const browserEntries = readMyOfferEntries();
        const merged = [...accountEntries];
        for (const entry of browserEntries) {
          if (!merged.some((candidate) => candidate.offerId === entry.offerId)) {
            merged.push(entry);
            await fetch(`/api/account/offer-entries/${entry.offerId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: entry.status }),
            });
          }
        }
        localStorage.setItem('signups4fastcash_my_offers', JSON.stringify(merged));
        setMyOfferIds(merged.map((entry) => entry.offerId));
      })
      .catch(() => {});
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

  const handleDelegatedAdminAccess = async (openPanel = true): Promise<boolean> => {
    if (!authUser) {
      showToast('Sign in first to use delegated admin access.');
      setAuthMode('signin');
      setAuthOpenRequest((request) => request + 1);
      return false;
    }
    const response = await fetch('/api/admin/unlock-user', { method: 'POST' }).catch(() => null);
    if (!response?.ok) {
      const data = await response?.json().catch(() => null) as { error?: string } | null;
      showToast(data?.error || 'This account does not have admin access.');
      return false;
    }
    const data = await response.json() as { token: string; role?: 'owner' | 'delegated' };
    localStorage.setItem('signups4fastcash_admin_token', data.token);
    setIsAdminUnlocked(true);
    if (openPanel) {
      setAdminPanelVisible(true);
      setActiveTab('admin');
    }
    setIsOwnerAdmin(data.role === 'owner');
    if (data.role === 'owner') void loadAdminUsernames(data.token);
    showToast(data.role === 'owner' ? 'Owner admin access enabled.' : 'Delegated admin access enabled.');
    return true;
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
    setAdminPanelVisible(false);
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
    fetch('/api/newsletter/subscribers')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load subscriber count'))))
      .then((data: { count?: number }) => setSubscriberCount(Number(data.count || 0)))
      .catch(() => {
        // Keep the count at zero if the public count endpoint is temporarily unavailable.
      });
  }, []);

  useEffect(() => {
    if (!isAdminUnlocked) return;
    const token = localStorage.getItem('signups4fastcash_admin_token');
    fetch('/api/newsletter/subscribers', {
      headers: token ? { 'x-admin-token': token } : {},
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load subscribers'))))
      .then((data: { subscribers?: NewsletterSubscriber[] }) => setSubscribers(data.subscribers || []))
      .catch(() => {
        // Keep the current list available if the admin endpoint is temporarily unavailable.
      });
  }, [isAdminUnlocked]);

  useEffect(() => {
    if (activeTab !== 'admin') return;

    const refreshOffers = () => {
      const token = localStorage.getItem('signups4fastcash_admin_token');
      fetch('/api/admin/offers', { headers: token ? { 'x-admin-token': token } : {} })
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

    const savedEntries = readMyOfferEntries();
    const existing = savedEntries.find((entry) => entry.offerId === offerId);
    if (!existing) {
      const nextEntries = [...savedEntries, { offerId, status: 'active' as const, updatedAt: new Date().toISOString() }];
      localStorage.setItem('signups4fastcash_my_offers', JSON.stringify(nextEntries));
      setMyOfferIds(nextEntries.map((entry) => entry.offerId));
      if (authUser) {
        void fetch(`/api/account/offer-entries/${offerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
      }
      showToast('Saved to My Offers so you can resume it later.');
    }

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

  const handleApproveOffer = async (
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
      const response = await fetch('/api/admin/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ offerId: approvedOffer.id }),
      }).catch(() => null);
      const result = await response?.json().catch(() => null) as { delivered?: number; error?: string } | null;
      if (response?.ok) {
        showToast(`Offer published. Newsletter delivered to ${result?.delivered || 0} verified subscribers.`);
      } else {
        showToast(result?.error || 'Offer published, but newsletter delivery failed.');
      }
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
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency }),
      });
      const data = await response.json().catch(() => null) as { error?: string; pendingConfirmation?: boolean; subscriberCount?: number } | null;
      if (!response.ok) {
        showToast(data?.error || 'Could not start your subscription.');
        return;
      }
      const newSub: NewsletterSubscriber = {
        id: `sub-${Date.now()}`,
        email,
        subscribedAt: new Date().toISOString(),
        verified: false,
        frequency,
      };
      setSubscribers((prev) => [newSub, ...prev.filter((subscriber) => subscriber.email !== email)]);
      if (typeof data?.subscriberCount === 'number') setSubscriberCount(data.subscriberCount);
      showToast(data?.pendingConfirmation ? 'Check your email to confirm the alerts.' : `Subscribed ${email} to ${frequency} earning alerts.`);
    } catch {
      showToast('Could not reach the newsletter service. Please try again.');
    }
  };

  const orderedLiveOffers = [...publicOffers].sort((a, b) => {
    if (sortBy === 'random') {
      return randomOfferOrder.indexOf(a.id) - randomOfferOrder.indexOf(b.id);
    }
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
      if (offerFilter === 'no-deposit' && !/\$0|no deposit/i.test(offer.depositRequired)) return false;
      if (offerFilter === 'paypal' && !/paypal/i.test(`${offer.honestTruth.summary} ${offer.honestTruth.hiddenFeesWarning} ${offer.payoutSpeed}`)) return false;
      if (offerFilter === 'fast' && !/instant|within \d+ (?:hours?|business days?)/i.test(offer.payoutSpeed)) return false;
      if (offerFilter === 'beginner' && offer.difficulty === 'Standard (10 min)') return false;
      if (offerFilter === 'purchase' && !/\$0|no deposit/i.test(offer.depositRequired)) return false;
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

  useEffect(() => {
    if (activeTab !== 'offers' || filteredOffers.length === 0 || localStorage.getItem('signups4fastcash_admin_token')) return;
    const visitorId = localStorage.getItem('signups4fastcash_visitor_id') || undefined;
    filteredOffers.forEach((offer, index) => {
      const impressionKey = `${offer.id}:${index}`;
      if (recordedImpressions.current.has(impressionKey)) return;
      recordedImpressions.current.add(impressionKey);
      void fetch('/api/analytics/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, position: index + 1, visitorId }),
      }).catch(() => {});
    });
  }, [activeTab, filteredOffers.map((offer) => offer.id).join('|')]);

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

  const handleResumeOffer = (offer: Offer) => {
    void handleClaimClick(offer.id);
    window.open(offer.referralUrl || offer.officialMerchantUrl, '_blank', 'noopener,noreferrer');
  };

  const handleMyOfferStatusChange = async (offerId: string, status: MyOfferStatus) => {
    setMyOfferIds(readMyOfferEntries().map((entry) => entry.offerId));
    if (authUser) {
      await fetch(`/api/account/offer-entries/${offerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch(() => {});
    }
    if (status !== 'completed') return;
    const response = await fetch(`/api/offers/${offerId}/completion-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    }).catch(() => null);
    showToast(response?.ok ? 'Thanks — your completion was saved.' : 'Saved locally, but we could not send the confirmation.');
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

  const scrollOffers = (direction: -1 | 1) => {
    const carousel = offersCarouselRef.current || document.getElementById('offers-carousel') as HTMLDivElement | null;
    if (!carousel) return;
    const start = carousel.scrollLeft;
    const target = Math.max(0, Math.min(
      start + direction * Math.max(carousel.clientWidth * 0.86, 320),
      carousel.scrollWidth - carousel.clientWidth,
    ));
    const distance = target - start;
    const duration = 420;
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      carousel.scrollLeft = start + distance * eased;
      if (progress < 1) window.requestAnimationFrame(animate);
    };
    window.requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (offersCarouselRef.current) {
      offersCarouselRef.current.scrollLeft = 0;
    }
  }, [filteredOffers]);

  const handleCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const carousel = offersCarouselRef.current;
    if (!carousel || (event.target instanceof Element && event.target.closest('button, a, input, select, textarea'))) return;
    carouselDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: carousel.scrollLeft,
    };
    carousel.setPointerCapture(event.pointerId);
  };

  const handleCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = carouselDragRef.current;
    const carousel = offersCarouselRef.current;
    if (!drag.active || !carousel) return;
    carousel.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
  };

  const handleCarouselPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    carouselDragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      data-site-theme="custom"
      style={{
        '--site-background': siteSettings.themeBackgroundColor,
        '--site-accent': siteSettings.themeAccentColor,
        '--site-panel': siteSettings.themePanelColor,
      } as React.CSSProperties}
      className="retro-desktop min-h-screen flex flex-col font-sans antialiased selection:bg-blue-200 selection:text-black"
    >
      <Navbar
        siteSettings={siteSettings}
        adminSection={adminSection}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMyOffers={() => setMyOffersOpen(true)}
        activeOfferCount={readMyOfferEntries().filter((entry) => entry.status === 'active').length}
        username={authUser?.username}
        avatarUrl={authUser?.avatarUrl}
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
        onAdminSection={(section) => {
          setAdminSection(section);
          if (isAdminUnlocked) {
            setAdminPanelVisible(true);
            setActiveTab('admin');
            return;
          }
          void handleDelegatedAdminAccess(false).then((unlocked) => {
            if (unlocked) {
              setAdminPanelVisible(true);
              setActiveTab('admin');
            }
          });
        }}
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
        {activeTab === 'offers' && <MyOffers
          offers={liveOffers}
          trackedOfferIds={myOfferIds}
          open={myOffersOpen}
          onClose={() => setMyOffersOpen(false)}
          onResume={handleResumeOffer}
          onStatusChange={handleMyOfferStatusChange}
        />}
        {authUser && activeTab === 'offers' && (
          <>
            <CommunityChat username={authUser?.username} userId={authUser?.id} avatarUrl={authUser?.avatarUrl} />
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
              offerFilter={offerFilter}
              setOfferFilter={setOfferFilter}
              totalOffersCount={publicOffers.length}
              featuredOffers={orderedLiveOffers}
              onOpenNewsletter={() => setIsNewsletterOpen(true)}
            />

            <div className="mx-auto max-w-7xl space-y-4 px-4 pb-7 sm:px-6 lg:px-8" id="offers">
              <HowItWorks />
              <CashBlueprint
                onOpenSofi={() => {
                  const sofiOffer = liveOffers.find((offer) => offer.id === 'offer-sofi-banking');
                  if (!sofiOffer) {
                    showToast('The SoFi offer is temporarily unavailable.');
                    return;
                  }
                  void handleClaimClick(sofiOffer.id);
                  window.open(sofiOffer.referralUrl || sofiOffer.officialMerchantUrl, '_blank', 'noopener,noreferrer');
                }}
              />
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
                      setOfferFilter('all');
                    }}
                    className="mt-4 px-3 py-1.5 rounded bg-white/10 text-xs font-mono text-white hover:bg-white/20"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="mx-auto max-w-7xl">
                  <div className="relative">
                    <div
                      ref={offersCarouselRef}
                      id="offers-carousel"
                      className="flex cursor-grab select-none justify-start touch-pan-x items-start snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pl-0 pr-1 pb-4 active:cursor-grabbing [scrollbar-color:rgba(148,163,184,.35)_transparent] [scrollbar-width:thin]"
                      onPointerDown={handleCarouselPointerDown}
                      onPointerMove={handleCarouselPointerMove}
                      onPointerUp={handleCarouselPointerUp}
                      onPointerCancel={handleCarouselPointerUp}
                      aria-label="Available offers carousel"
                    >
                      {filteredOffers.map((offer) => (
                        <div key={offer.id} className="min-w-0 shrink-0 basis-[86vw] snap-start self-start sm:basis-[47%] lg:basis-[31.5%] xl:basis-[24%]">
                          <OfferCard
                            offer={offer}
                            onClaimClick={handleClaimClick}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollOffers(-1)}
                      className="focus-ring absolute left-0 top-1/2 z-20 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200/35 bg-[#101722]/90 text-cyan-100 shadow-[0_12px_35px_rgba(0,0,0,0.45),0_0_24px_rgba(45,212,238,0.16)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-[#17283a] hover:text-white sm:left-2 sm:h-16 sm:w-16"
                      aria-label="Show previous offers"
                    >
                      <ChevronLeft className="h-7 w-7" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollOffers(1)}
                      className="focus-ring absolute right-0 top-1/2 z-20 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200/35 bg-[#101722]/90 text-cyan-100 shadow-[0_12px_35px_rgba(0,0,0,0.45),0_0_24px_rgba(45,212,238,0.16)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-[#17283a] hover:text-white sm:right-2 sm:h-16 sm:w-16"
                      aria-label="Show next offers"
                    >
                      <ChevronRight className="h-7 w-7" />
                    </button>
                  </div>
                  <p className="mt-1 text-center text-[10px] font-mono text-zinc-500">
                    Swipe, scroll, or use the floating arrows to browse offers
                  </p>
                </div>
              )}
            </div>

            <TrustAndFaq siteSettings={siteSettings} />
          </div>
        )}
        {activeTab === 'admin' && isAdminUnlocked && adminPanelVisible && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <AdminDashboard
                initialView={adminSection === 'blasts' ? 'email' : 'offers'}
                pendingOffers={pendingOffers}
                liveOffers={liveOffers}
                subscribers={subscribers}
                onApproveOffer={handleApproveOffer}
                onRejectOffer={handleRejectOffer}
                onUpdateLiveOffer={handleUpdateLiveOffer}
                onDeleteLiveOffer={handleDeleteLiveOffer}
                onCreateCustomOffer={handleCreateCustomOffer}
                blastLogs={blastLogs}
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
        subscriberCount={subscriberCount}
      />

      <AuthModal user={authUser} onUserChange={setAuthUser} openRequest={authOpenRequest} mode={authMode} disabled={recordingMode} />
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
      {messageNotification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-cyan-300/40 bg-[#0d1724] p-4 text-sm text-cyan-100 shadow-2xl">
          <div className="font-bold">New message</div>
          <p className="mt-1 text-xs text-cyan-100/80">
            {messageNotification.count > 1 ? `${messageNotification.count} new messages` : messageNotification.preview}
          </p>
          <button
            type="button"
            onClick={() => setMessageNotification(null)}
            className="mt-3 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10"
          >
            Dismiss
          </button>
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
            setAdminPanelVisible(true);
            setActiveTab('admin');
          }
        }}
        isAdminUnlocked={isAdminUnlocked}
      />

      <LegalModal section={legalSection} onClose={() => setLegalSection(null)} />
      {offerFinderOpen && <OfferFinder offers={publicOffers} onViewOffer={handleFinderOffer} onClose={() => setOfferFinderOpen(false)} />}
      {analyticsConsent === 'unknown' && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-xl border border-cyan-400/30 bg-[#0d1724] p-4 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-zinc-300">
              We use optional analytics to understand aggregate visits and approximate country/region. No exact location or raw IP is stored for this feature. You can decline and still use the site.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => updateAnalyticsConsent('denied')}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-white/10"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => updateAnalyticsConsent('granted')}
                className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-mono font-semibold text-[#06131a] hover:bg-cyan-300"
              >
                Allow analytics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
