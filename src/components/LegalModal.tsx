import React from 'react';
import { X } from 'lucide-react';

type LegalSection = 'privacy' | 'terms' | 'affiliate';

interface LegalModalProps {
  section: LegalSection | null;
  onClose: () => void;
}

const CONTENT: Record<LegalSection, { title: string; body: React.ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>We collect information you choose to submit, such as your email address when you subscribe to alerts. We use it to provide the requested alerts and maintain the service.</p>
        <p>We may also receive basic technical information from your browser and hosting provider, such as request time, device type, and IP address, for security and reliability.</p>
        <p>We do not sell your personal information. Merchant websites have their own privacy policies, and you should review them before applying through an external link.</p>
        <p>To request removal of a newsletter address or ask a privacy question, contact the site operator through the email address listed in the deployment configuration.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms and Disclaimer',
    body: (
      <>
        <p>This site provides promotional information and comparison tools. It is not financial, tax, legal, investment, credit, or gambling advice.</p>
        <p>Offers are controlled by third-party merchants. Eligibility, geographic availability, requirements, fees, taxes, payout timing, and expiration dates can change. Confirm the official merchant terms before applying.</p>
        <p>We do not hold funds, complete applications, guarantee approval, or guarantee that a merchant will issue a reward. You are responsible for deciding whether an offer is appropriate for you.</p>
        <p>External links take you to third-party websites. We are not responsible for their content, security, availability, or decisions.</p>
      </>
    ),
  },
  affiliate: {
    title: 'Affiliate Disclosure',
    body: (
      <>
        <p>Some links on this site are referral or affiliate links. If you use one, the merchant may compensate us at no additional cost to you.</p>
        <p>Affiliate compensation does not change the merchant's eligibility rules, approval decisions, fees, or payout obligations.</p>
        <p>We aim to describe requirements plainly, but the official merchant terms are the controlling source. Please report outdated or inaccurate offer information so it can be reviewed.</p>
      </>
    ),
  },
};

export const LegalModal: React.FC<LegalModalProps> = ({ section, onClose }) => {
  if (!section) return null;
  const content = CONTENT[section];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-[#0c1017] border border-white/[0.12] p-6 text-sm text-zinc-300 leading-relaxed">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white" aria-label="Close legal information">
          <X className="w-5 h-5" />
        </button>
        <h2 className="pr-8 text-xl font-bold text-white">{content.title}</h2>
        <div className="mt-5 space-y-4">{content.body}</div>
        <p className="mt-6 border-t border-white/[0.08] pt-4 text-xs text-zinc-500">Last reviewed: September 10, 2026. This information is general and may need updating as the service changes.</p>
      </div>
    </div>
  );
};
