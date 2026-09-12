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
      </defs>
      <circle cx="50" cy="50" r="47" fill="#0f172a" stroke="#020617" strokeWidth="4" />
      <circle cx="50" cy="50" r="43" fill={`url(#${id}-rim)`} stroke="#67e8f9" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="35.5" fill={`url(#${id}-face)`} stroke="#bfdbfe" strokeOpacity=".8" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="31" fill="none" stroke="#dbeafe" strokeOpacity=".35" strokeDasharray="2 3" strokeWidth="1.5" />
      <path d="M50 18v7M50 75v7M18 50h7M75 50h7" stroke="#ecfeff" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 31l5 3M67 66l5 3M69 31l-5 3M33 66l-5 3" stroke="#ecfeff" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round" />
      <text x="50" y="57" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="900" letterSpacing="-1" fill={`url(#${id}-letter)`} stroke="#052e16" strokeWidth=".7" paintOrder="stroke">
        SFC
      </text>
      <path d="M26 24c12-10 30-13 45-4" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M29 30L50 2l21 28c-13-4-29-4-42 0Z" fill="#22c55e" stroke="#052e16" strokeWidth="2" strokeLinejoin="round" />
      <path d="M29 30L50 2v28c-7-2-14-2-21 0Z" fill="#4ade80" fillOpacity=".9" />
      <path d="M50 2L71 30c-7-2-14-2-21 0Z" fill="#15803d" fillOpacity=".9" />
      <path d="M50 3v26" stroke="#dcfce7" strokeOpacity=".75" strokeWidth="1.5" />
      <path d="M26 29c15-4 33-4 48 0l-3 6c-13-4-29-4-42 0Z" fill="#166534" stroke="#052e16" strokeWidth="1.5" />
      <path d="M29 30c14-3 28-3 42 0" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
