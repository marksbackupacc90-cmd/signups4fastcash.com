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
      className="shrink-0 drop-shadow-[0_0_14px_rgba(34,211,238,.35)]"
    >
      <defs>
        <linearGradient id={`${id}-badge`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="48%" stopColor="#4f9d78" />
          <stop offset="100%" stopColor="#315c53" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="90" height="90" rx="25" fill="#101a16" stroke="#806548" strokeWidth="3" />
      <rect x="12" y="12" width="76" height="76" rx="19" fill={`url(#${id}-badge)`} />
      <path d="M18 18h45L18 63z" fill={`url(#${id}-shine)`} />
      <path d="M24 70h52" stroke="#dbeafe" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
      <text x="50" y="59" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="25" fontWeight="900" letterSpacing="-1.5" fill="#f4f7ed" stroke="#315c53" strokeWidth="1.2" paintOrder="stroke">S4FC</text>
      <circle cx="76" cy="24" r="4" fill="#d6a96d" />
    </svg>
  );
};
