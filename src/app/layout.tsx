import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Tasky - Drag & Drop Activity & Progress Tracker',
  description:
    'Intuitive drag-and-drop activity and daily task tracker with custom progress visualization charts, time blocking, and focus metrics.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Tasky',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#18181b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script adds the `dark` class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-page text-slate-900 antialiased font-sans selection:bg-amber-100 selection:text-amber-900`}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
