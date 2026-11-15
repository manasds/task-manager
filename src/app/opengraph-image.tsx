import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

// The link preview image (Open Graph; X uses it too). Built once at build time, in the
// sticker look: white page, a zinc tray of lifted white cards, the lime mark and stickers.

export const alt = 'Tasky: a task board, calendar and focus timer for what you build and what you learn.';

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

const INK = '#18181b';
const MUTED = '#71717b';
const LINE = '#e4e4e7';
const TRAY = '#f4f4f5';
const LIME = '#d8f999';

/** Lucide's clock, the navbar glyph. */
const CLOCK_GLYPH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;

// The stat-strip stickers from components/Sticker.tsx, die-cut outline first.
const CLOCK_STICKER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="37" fill="#fff" stroke="#fff" stroke-width="14"/><circle cx="50" cy="50" r="37" fill="#9db4ff"/><circle cx="50" cy="50" r="27" fill="#fff"/><path d="M50 33V50L61 58" fill="none" stroke="#1b2a3a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FLAME = 'M53 9C58 24 77 35 77 58C77 77 65 90 50 90C35 90 23 77 23 60C23 47 30 39 34 29C38 37 42 39 46 37C44 26 47 16 53 9Z';

const FLAME_STICKER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${FLAME}" fill="#fff" stroke="#fff" stroke-width="15" stroke-linejoin="round"/><path d="${FLAME}" fill="#ff7319"/><path d="M50 50C58 60 62 66 62 73C62 80 56 85 50 85C44 85 38 80 38 73C38 64 46 60 50 50Z" fill="#ffe32e"/></svg>`;

const svgSrc = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/** The same lift as the app's `card-lift`, a touch stronger so it survives image compression. */
const CARD = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 20,
  boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04)',
} as const;

// Category chips use the light-theme --cat-* values from globals.css.
const CHIPS = {
  build: { label: 'Build', background: '#e7e5ff', color: '#2f22b8' },
  learn: { label: 'Learn', background: '#fbe4f6', color: '#8a1877' },
};

const TASKS = [
  { category: CHIPS.build, title: 'Ship the sync fix', minutes: '45m' },
  { category: CHIPS.learn, title: 'Read: Postgres row locks', minutes: '30m' },
  { category: CHIPS.build, title: 'Sketch the landing page', minutes: '1h 15m' },
];

const STATS = [
  { sticker: CLOCK_STICKER, tile: '#dfe7ff', label: 'Focus Logged', value: '3h 20m' },
  { sticker: FLAME_STICKER, tile: '#ffdfe2', label: 'Streak', value: '12 days' },
];

export default async function OpenGraphImage() {
  const fonts = join(process.cwd(), 'src/assets/fonts');

  const [regular, semibold, mono] = await Promise.all([
    readFile(join(fonts, 'Geist-Regular.ttf')),
    readFile(join(fonts, 'Geist-SemiBold.ttf')),
    readFile(join(fonts, 'GeistMono-Medium.ttf')),
  ]);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#fff', fontFamily: 'Geist', color: INK, padding: 64 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560, paddingTop: 8, paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 19,
                backgroundColor: LIME,
                transform: 'rotate(-4deg)',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.18)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain <img>; next/image can't run here. */}
              <img src={svgSrc(CLOCK_GLYPH)} width={34} height={34} alt="" />
            </div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, letterSpacing: '-0.025em' }}>{SITE_NAME}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 70, lineHeight: 1.04, letterSpacing: '-0.04em' }}>
              <span>Plan the day.</span>
              <span>See the hours.</span>
            </div>
            <div style={{ display: 'flex', fontSize: 27, lineHeight: 1.4, color: MUTED, letterSpacing: '-0.01em' }}>
              A board, a calendar and a focus timer for what you build and what you learn.
            </div>
          </div>

          <div style={{ display: 'flex', fontFamily: 'Geist Mono', fontSize: 21, color: '#9f9fa9' }}>tasky.manasbuilds.me</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginLeft: 'auto',
            width: 476,
            padding: 20,
            borderRadius: 36,
            backgroundColor: TRAY,
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            {STATS.map((stat) => (
              <div key={stat.label} style={{ ...CARD, flex: 1, gap: 14, padding: '14px 18px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: stat.tile,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain <img>; next/image can't run here. */}
                  <img src={svgSrc(stat.sticker)} width={36} height={36} alt="" style={{ transform: 'rotate(-6deg)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: MUTED }}>{stat.label}</span>
                  <span style={{ fontFamily: 'Geist Mono', fontSize: 25, letterSpacing: '-0.02em' }}>{stat.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 6px 0' }}>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Doing</span>
            <span
              style={{
                display: 'flex',
                padding: '2px 9px',
                borderRadius: 999,
                backgroundColor: '#e4e4e7',
                fontFamily: 'Geist Mono',
                fontSize: 15,
                color: MUTED,
              }}
            >
              {TASKS.length}
            </span>
          </div>

          {TASKS.map((task) => (
            <div key={task.title} style={{ ...CARD, flexDirection: 'column', alignItems: 'flex-start', gap: 9, padding: '13px 18px' }}>
              <span
                style={{
                  display: 'flex',
                  padding: '3px 10px',
                  borderRadius: 7,
                  backgroundColor: task.category.background,
                  color: task.category.color,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {task.category.label}
              </span>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{task.title}</span>
                <span style={{ fontFamily: 'Geist Mono', fontSize: 18, color: MUTED }}>{task.minutes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: regular, weight: 400, style: 'normal' },
        { name: 'Geist', data: semibold, weight: 600, style: 'normal' },
        { name: 'Geist Mono', data: mono, weight: 500, style: 'normal' },
      ],
    }
  );
}
