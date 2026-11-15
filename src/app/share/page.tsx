import type { Metadata } from 'next';
import ShareSheet from '@/components/share/ShareSheet';

// Opened by the phone's share sheet; nothing here for search.
export const metadata: Metadata = { title: { absolute: 'Save to Tasky' }, robots: { index: false, follow: false } };

export default function SharePage() {
  return <ShareSheet />;
}
