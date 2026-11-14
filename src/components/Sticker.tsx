import React from 'react';

export type StickerName = 'check' | 'clock' | 'target' | 'flame';

const FLAME =
  'M53 9C58 24 77 35 77 58C77 77 65 90 50 90C35 90 23 77 23 60C23 47 30 39 34 29C38 37 42 39 46 37C44 26 47 16 53 9Z';

/** Each drawing is its white die-cut outline first, then the artwork on top. Colours are fixed: stickers look the same in light and dark. */
const ART: Record<StickerName, React.ReactNode> = {
  check: (
    <>
      <rect x="15" y="15" width="70" height="70" rx="19" fill="#fff" stroke="#fff" strokeWidth="14" transform="rotate(-8 50 50)" />
      <rect x="15" y="15" width="70" height="70" rx="19" fill="#d4eb8a" transform="rotate(-8 50 50)" />
      <path d="M32 52L45 65L69 36" fill="none" stroke="#124e43" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="50" cy="50" r="37" fill="#fff" stroke="#fff" strokeWidth="14" />
      <circle cx="50" cy="50" r="37" fill="#9db4ff" />
      <circle cx="50" cy="50" r="27" fill="#fff" />
      <path d="M50 33V50L61 58" fill="none" stroke="#1b2a3a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  target: (
    <>
      <circle cx="50" cy="50" r="37" fill="#fff" stroke="#fff" strokeWidth="14" />
      <circle cx="50" cy="50" r="37" fill="#ff7678" />
      <circle cx="50" cy="50" r="24" fill="#fff" />
      <circle cx="50" cy="50" r="11" fill="#ff4144" />
    </>
  ),
  flame: (
    <>
      <path d={FLAME} fill="#fff" stroke="#fff" strokeWidth="15" strokeLinejoin="round" />
      <path d={FLAME} fill="#ff7319" />
      <path d="M50 50C58 60 62 66 62 73C62 80 56 85 50 85C44 85 38 80 38 73C38 64 46 60 50 50Z" fill="#ffe32e" />
    </>
  ),
};

interface StickerProps {
  name: StickerName;
  /** Size and tilt, e.g. "size-7 -rotate-6". Stickers are decoration, so they are hidden from assistive tech. */
  className?: string;
}

export const Sticker: React.FC<StickerProps> = ({ name, className = '' }) => (
  <svg viewBox="0 0 100 100" aria-hidden="true" className={`sticker ${className}`}>
    {ART[name]}
  </svg>
);
