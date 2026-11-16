import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** The one public page. The canvas and the rest need a sign-in or come from another app. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 }];
}
