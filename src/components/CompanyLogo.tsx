import React from 'react';

interface CompanyLogoProps {
  slug?: string;
  companyName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  slug,
  companyName,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];

  const normalized = (slug || companyName).toLowerCase();

  // SoFi logo
  if (normalized.includes('sofi')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#00adb5] flex items-center justify-center p-1.5 shadow-sm text-white font-black tracking-tighter shrink-0 select-none`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="18" r="3" />
        </svg>
      </div>
    );
  }

  // Webull logo
  if (normalized.includes('webull')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#0c4a6e] border border-blue-500/30 flex items-center justify-center p-1.5 shadow-sm text-blue-400 font-bold shrink-0 select-none`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M4 17l4-9 4 9 4-9 4 9" />
        </svg>
      </div>
    );
  }

  // Rakuten logo
  if (normalized.includes('rakuten')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#bf0000] flex items-center justify-center text-white font-black shrink-0 select-none`}>
        <span className="font-extrabold tracking-tight">R</span>
      </div>
    );
  }

  // Chime logo
  if (normalized.includes('chime')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#25c974] flex items-center justify-center text-[#063319] font-black shrink-0 select-none`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z"/>
        </svg>
      </div>
    );
  }

  // Robinhood logo
  if (normalized.includes('robinhood')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#00c805] flex items-center justify-center p-1.5 text-black shrink-0 select-none shadow-sm`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
          <path d="M18.8 4c-.7 0-1.3.4-1.6 1L12 17l-3.2-6.5c-.3-.6-.9-1-1.6-1-.9 0-1.7.8-1.7 1.7 0 .4.1.7.3 1L11 21.2c.4.6 1 1 1.7 1s1.3-.4 1.7-1l7.4-15c.2-.3.3-.6.3-1 0-.9-.8-1.7-1.7-1.7z"/>
        </svg>
      </div>
    );
  }

  // Revolut logo
  if (normalized.includes('revolut')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#191c1f] border border-white/10 flex items-center justify-center text-white font-black shrink-0 select-none`}>
        <span className="font-mono text-sm font-bold">R</span>
      </div>
    );
  }

  // Coinbase logo
  if (normalized.includes('coinbase')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#0052ff] flex items-center justify-center p-1.5 text-white shrink-0 select-none`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
          <circle cx="12" cy="12" r="9" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" fill="#0052ff" />
        </svg>
      </div>
    );
  }

  // Acorns logo
  if (normalized.includes('acorns')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#70be44] flex items-center justify-center p-1.5 text-white shrink-0 select-none`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
          <path d="M12 2C7 2 4 5 4 8c0 1.5.5 3 1.5 4.2C6.5 13.5 8 16 10 20c.5 1 1.5 2 2 2s1.5-1 2-2c2-4 3.5-6.5 4.5-7.8 1-1.2 1.5-2.7 1.5-4.2 0-3-3-6-8-6z"/>
        </svg>
      </div>
    );
  }

  // TopCashback logo
  if (normalized.includes('topcashback')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#f59e0b] flex items-center justify-center text-black font-extrabold shrink-0 select-none`}>
        <span className="font-mono text-xs">TCB</span>
      </div>
    );
  }

  // Discover logo
  if (normalized.includes('discover')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#ff6000] flex items-center justify-center text-white font-bold shrink-0 select-none`}>
        <span className="text-[10px] tracking-tight font-extrabold">DISC</span>
      </div>
    );
  }

  // Stake.us logo
  if (normalized.includes('stake')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#14233c] border border-cyan-400/30 flex items-center justify-center text-white font-extrabold shrink-0 select-none shadow-sm`}>
        <span className="text-[11px] font-black tracking-wider text-[#00f2fe]">STAKE</span>
      </div>
    );
  }

  // Freecash logo
  if (normalized.includes('freecash')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#00e700] flex items-center justify-center text-black font-black shrink-0 select-none shadow-sm`}>
        <span className="text-[11px] font-black tracking-tight font-mono">FC</span>
      </div>
    );
  }

  // Capital One logo
  if (normalized.includes('capital one') || normalized.includes('capitalone')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#d03027] flex items-center justify-center text-white font-extrabold shrink-0 select-none shadow-sm`}>
        <span className="text-[10px] font-black tracking-tighter">C1</span>
      </div>
    );
  }

  // AceBet logo
  if (normalized.includes('acebet')) {
    return (
      <div className={`${sizeClasses} ${className} rounded-lg bg-[#7c3aed] border border-amber-400/40 flex items-center justify-center text-amber-300 font-black shrink-0 select-none shadow-sm`}>
        <span className="text-[11px] font-black tracking-wider">ACE</span>
      </div>
    );
  }

  // Clean fallback with initials
  const initials = companyName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`${sizeClasses} ${className} rounded-lg bg-[#1a1f2c] border border-white/10 flex items-center justify-center text-[#38bdf8] font-mono font-bold shrink-0 select-none`}>
      {initials || '$'}
    </div>
  );
};
