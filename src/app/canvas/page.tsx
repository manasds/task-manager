import type { Metadata } from 'next';
import CanvasView from '@/components/canvas/CanvasView';

// Signed out, the canvas is only a sign-in prompt, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Canvas',
  description: 'Your saved links, articles and videos, arranged on a board to read later.',
  robots: { index: false, follow: true },
};

export default function CanvasPage() {
  return <CanvasView />;
}
