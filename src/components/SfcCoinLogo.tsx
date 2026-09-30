import React from 'react';

interface SfcCoinLogoProps {
  size?: 'sm' | 'md';
}

export const SfcCoinLogo: React.FC<SfcCoinLogoProps> = ({ size = 'md' }) => {
  const dimension = size === 'sm' ? 48 : 64;
  const id = `sfc-coin-${size}`;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 100 100"
      role="img"
      aria-label="SFC coin logo"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`${id}-badge`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#46a66c" />
          <stop offset="55%" stopColor="#197344" />
          <stop offset="100%" stopColor="#125d36" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".6" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="90" height="90" rx="25" fill="#f4f8f5" stroke="#197344" strokeWidth="3" />
      <rect x="12" y="12" width="76" height="76" rx="19" fill={`url(#${id}-badge)`} />
      <path d="M18 18h45L18 63z" fill={`url(#${id}-shine)`} />
      <path d="M24 70h52" stroke="#ffffff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      <text x="50" y="59" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="25" fontWeight="900" letterSpacing="-1.5" fill="#ffffff" stroke="#125d36" strokeWidth="1.2" paintOrder="stroke">S4FC</text>
      <circle cx="76" cy="24" r="4" fill="#d9f0df" />
    </svg>
  );
};
