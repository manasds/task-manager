import React from 'react';

export type StickerName = 'check' | 'clock' | 'target' | 'flame' | 'star' | 'spark' | 'smile' | 'moon';

const STAR_POINTS = '50,10 61.2,36.6 89.9,39 68.1,57.9 74.7,86 50,71 25.3,86 31.9,57.9 10.1,39 38.8,36.6';
const SPARK_BIG = 'M44 10C47 36 58 47 84 50C58 53 47 64 44 90C41 64 30 53 4 50C30 47 41 36 44 10Z';
const SPARK_SMALL = 'M80 60C81.5 72 86 76.5 98 78C86 79.5 81.5 84 80 96C78.5 84 74 79.5 62 78C74 76.5 78.5 72 80 60Z';

const FLAME =
  'M53 9C58 24 77 35 77 58C77 77 65 90 50 90C35 90 23 77 23 60C23 47 30 39 34 29C38 37 42 39 46 37C44 26 47 16 53 9Z';

const MOON =
  'M50 12C72 12 88 28 88 50C88 72 72 88 50 88C28 88 12 72 12 50C12 44 13 39 16 34C22 44 34 50 46 46C54 43 56 30 50 12Z';

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
  star: (
    <>
      <polygon points={STAR_POINTS} fill="#fff" stroke="#fff" strokeWidth="17" strokeLinejoin="round" />
      <polygon points={STAR_POINTS} fill="#4d3dfd" stroke="#4d3dfd" strokeWidth="6" strokeLinejoin="round" />
      <ellipse cx="42" cy="48" rx="5" ry="6" fill="#fff" />
      <ellipse cx="58" cy="48" rx="5" ry="6" fill="#fff" />
      <circle cx="43.5" cy="49.5" r="2.6" fill="#0a0a0a" />
      <circle cx="59.5" cy="49.5" r="2.6" fill="#0a0a0a" />
      <path d="M43 60Q50 66 57 60" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  spark: (
    <>
      <path d={SPARK_BIG} fill="#fff" stroke="#fff" strokeWidth="15" strokeLinejoin="round" />
      <path d={SPARK_SMALL} fill="#fff" stroke="#fff" strokeWidth="11" strokeLinejoin="round" />
      <path d={SPARK_BIG} fill="#ffd242" stroke="#ffd242" strokeWidth="3" strokeLinejoin="round" />
      <path d={SPARK_SMALL} fill="#ffd242" stroke="#ffd242" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  smile: (
    <>
      <circle cx="50" cy="50" r="37" fill="#fff" stroke="#fff" strokeWidth="14" />
      <circle cx="50" cy="50" r="37" fill="#ffd242" />
      <path d="M33 44Q38 38 43 44M57 44Q62 38 67 44" fill="none" stroke="#1b2a3a" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M34 57Q50 73 66 57" fill="none" stroke="#1b2a3a" strokeWidth="4.5" strokeLinecap="round" />
    </>
  ),
  moon: (
    <>
      <path d={MOON} fill="#fff" stroke="#fff" strokeWidth="14" strokeLinejoin="round" />
      <path d={MOON} fill="#7876ff" />
      <path d="M40 60Q45 55 50 60M60 60Q65 55 70 60" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
};

interface StickerProps {
  name: StickerName;
  /** Size and placement, e.g. "size-12 -rotate-6". Stickers are decoration, so they are hidden from assistive tech. */
  className?: string;
}

export const Sticker: React.FC<StickerProps> = ({ name, className = '' }) => (
  <svg viewBox="0 0 100 100" aria-hidden="true" className={`sticker ${className}`}>
    {ART[name]}
  </svg>
);
