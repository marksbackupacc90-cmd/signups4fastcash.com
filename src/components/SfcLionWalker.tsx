import React from 'react';

export const SfcLionWalker: React.FC = () => (
  <svg width="170" height="190" viewBox="0 0 170 190" role="img" aria-label="SFC crowned lion walking out of a coin" className="drop-shadow-[0_8px_16px_rgba(0,0,0,.45)]">
    <defs>
      <linearGradient id="walker-mane" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="55%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#451a03" />
      </linearGradient>
      <linearGradient id="walker-body" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="58%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="walker-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff7b2" />
        <stop offset="45%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#a16207" />
      </linearGradient>
    </defs>
    <ellipse cx="86" cy="174" rx="58" ry="10" fill="#020617" opacity=".45" />
    <ellipse cx="86" cy="165" rx="50" ry="18" fill="#2563eb" stroke="#67e8f9" strokeWidth="3" />
    <ellipse cx="86" cy="160" rx="40" ry="13" fill="#1e40af" stroke="#bfdbfe" strokeWidth="2" />
    <text x="86" y="164" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="900" fill="#86efac" letterSpacing="2">SFC</text>
    <path d="M53 103c-16 3-22 16-13 25 8 8 22 3 30-8" fill="none" stroke="#78350f" strokeWidth="12" strokeLinecap="round" />
    <path d="M50 91c9-18 38-25 69-14 19 7 27 25 17 38-8 11-25 13-42 10-22-4-41-14-44-34Z" fill="url(#walker-body)" stroke="#451a03" strokeWidth="3" />
    <path d="M72 112c-4 18-1 29 8 41M105 112c4 17 1 29-8 41" fill="none" stroke="#78350f" strokeWidth="11" strokeLinecap="round" />
    <path d="M78 148l-7 12M99 148l7 12" stroke="#451a03" strokeWidth="5" strokeLinecap="round" />
    <path d="M76 126c4 6 10 7 15 1M103 126c-4 6-10 7-15 1" fill="none" stroke="#fbbf24" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
    <path d="M55 86c-12-9-11-28 2-36 3-16 20-25 34-17 15-9 32 0 35 16 14 8 14 28 2 37 4 17-10 29-25 26-11 12-30 8-36-5-15 2-25-8-12-21Z" fill="url(#walker-mane)" stroke="#451a03" strokeWidth="3" />
    <path d="M67 70c0-16 10-25 21-25s21 9 21 25v22c0 15-9 23-21 23s-21-8-21-23Z" fill="#d97706" stroke="#78350f" strokeWidth="2" />
    <path d="M70 72c6-8 12-8 18-2 6-6 12-6 18 2" fill="none" stroke="#451a03" strokeWidth="5" strokeLinecap="round" />
    <path d="M72 71c4-6 10-5 16 1M104 71c-4-6-10-5-16 1" fill="none" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" />
    <path d="M75 73c4-4 9-3 13 1M101 73c-4-4-9-3-13 1" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1.5" />
    <path d="M76 71l8 4M100 71l-8 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="83" cy="73" r="1.5" fill="#fff" /><circle cx="95" cy="73" r="1.5" fill="#fff" />
    <path d="M79 88c3-6 17-6 20 0v10c-4 8-16 8-20 0Z" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
    <path d="M86 88c2-2 4-2 6 0l-3 4Z" fill="#1c0b02" />
    <path d="M89 92v7M82 97c5 3 9 3 14 0" fill="none" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />
    <path d="M66 49L56 36l16 4 10-16 8 17 12-17 5 18 16-5-10 15" fill="url(#walker-gold)" stroke="#422006" strokeWidth="3" strokeLinejoin="round" />
    <path d="M58 47c17-6 34-6 51 0l-3 8c-15-4-30-4-45 0Z" fill="#eab308" stroke="#78350f" strokeWidth="2" />
    <circle cx="56" cy="36" r="3" fill="#fff7b2" /><circle cx="82" cy="24" r="3" fill="#fff7b2" /><circle cx="101" cy="24" r="3" fill="#fff7b2" />
  </svg>
);
