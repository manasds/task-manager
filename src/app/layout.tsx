import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
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
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script adds the `dark` class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${jakarta.variable} ${jetbrains.variable} bg-slate-50 text-slate-900 antialiased font-sans selection:bg-indigo-100 selection:text-indigo-900`}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
