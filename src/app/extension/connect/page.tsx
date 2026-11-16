import type { Metadata } from 'next';
import ExtensionConnect from '@/components/extension/ExtensionConnect';

// Opened by the browser extension's sign-in window; nothing here for search.
export const metadata: Metadata = { title: 'Connect extension', robots: { index: false, follow: false } };

export default function ExtensionConnectPage() {
  return <ExtensionConnect />;
}
