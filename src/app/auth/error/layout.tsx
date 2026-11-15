import type { Metadata } from 'next';

// The page itself is a client component, which can't export metadata.
export const metadata: Metadata = { title: 'Sign-in did not finish', robots: { index: false, follow: false } };

export default function AuthErrorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
