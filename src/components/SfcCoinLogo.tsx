import React from 'react';

interface SfcCoinLogoProps {
  size?: 'sm' | 'md';
}

export const SfcCoinLogo: React.FC<SfcCoinLogoProps> = ({ size = 'md' }) => {
  const dimension = size === 'sm' ? 32 : 42;
  const id = `sfc-coin-${size}`;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 100 100"
      role="img"
      aria-label="SFC coin logo"
      className="shrink-0 drop-shadow-[0_0_14px_rgba(34,211,238,.4)]"
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#f8ffff" />
          <stop offset="18%" stopColor="#67e8f9" />
          <stop offset="52%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#312e81" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ecfeff" />
          <stop offset="24%" stopColor="#22d3ee" />
          <stop offset="52%" stopColor="#1d4ed8" />
          <stop offset="78%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={`${id}-letter`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dcfce7" />
          <stop offset="45%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id={`${id}-hat`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#fff7a8" />
          <stop offset="28%" stopColor="#fde047" />
          <stop offset="65%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <filter id={`${id}-hat-shadow`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#422006" floodOpacity=".65" />
        </filter>
        <radialGradient id={`${id}-mane`} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="58%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#451a03" />
        </radialGradient>
        <linearGradient id={`${id}-crown`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff7b2" />
          <stop offset="28%" stopColor="#facc15" />
          <stop offset="65%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#0f172a" stroke="#020617" strokeWidth="4" />
      <circle cx="50" cy="50" r="43" fill={`url(#${id}-rim)`} stroke="#67e8f9" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="35.5" fill={`url(#${id}-face)`} stroke="#bfdbfe" strokeOpacity=".8" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="31" fill="none" stroke="#dbeafe" strokeOpacity=".35" strokeDasharray="2 3" strokeWidth="1.5" />
      <path d="M50 18v7M50 75v7M18 50h7M75 50h7" stroke="#ecfeff" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 31l5 3M67 66l5 3M69 31l-5 3M33 66l-5 3" stroke="#ecfeff" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round" />
      <g>
        <path d="M29 43c-7-8-4-16 4-14 3-8 11-9 17-5 6-4 14-3 17 5 8-2 11 6 4 14 5 7 2 16-5 18 0 9-8 14-16 10-8 4-16-1-16-10-7-2-10-11-5-18Z" fill={`url(#${id}-mane)`} stroke="#451a03" strokeWidth="2" />
        <path d="M36 40c0-9 6-14 14-14s14 5 14 14v18c0 9-6 14-14 14s-14-5-14-14Z" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
        <path d="M38 43c4-5 9-6 12-2 3-4 8-3 12 2" fill="none" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 43c3-4 8-4 10 1M60 43c-3-4-8-4-10 1" fill="none" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" />
        <path d="M41 44c2-3 6-3 9 0M59 44c-2-3-6-3-9 0" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1" />
        <path d="M42 43l2 3M59 43l-2 3" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />
        <circle cx="46" cy="44" r="1" fill="#fff" /><circle cx="54" cy="44" r="1" fill="#fff" />
        <path d="M43 56c2-4 12-4 14 0v7c-2 6-12 6-14 0Z" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
        <path d="M47 56c2-2 4-2 6 0l-3 3Z" fill="#451a03" />
        <path d="M50 59v4M45 62c3 2 7 2 10 0" fill="none" stroke="#451a03" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M38 57l-8-2M38 62l-9 1M62 57l8-2M62 62l9 1" stroke="#fef3c7" strokeOpacity=".7" strokeWidth="1" strokeLinecap="round" />
        <text x="50" y="77" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="900" letterSpacing="1" fill="#fef3c7">SFC</text>
      </g>
      <g filter={`url(#${id}-hat-shadow)`}>
        <path d="M29 32L31 16l10 8 9-15 9 15 10-8 2 16c-14-4-27-4-41 0Z" fill={`url(#${id}-crown)`} stroke="#422006" strokeWidth="2" strokeLinejoin="round" />
        <path d="M30 31c13-4 27-4 40 0l-2 6c-12-3-24-3-36 0Z" fill="#eab308" stroke="#78350f" strokeWidth="1.5" />
        <circle cx="31" cy="17" r="2" fill="#fff7b2" /><circle cx="50" cy="9" r="2" fill="#fff7b2" /><circle cx="69" cy="17" r="2" fill="#fff7b2" />
      </g>
    </svg>
  );
};
