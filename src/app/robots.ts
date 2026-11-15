import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Every crawler, AI answer engines included, may read the public pages. The API and the
 * pages opened by the share sheet, the extension and sign-in errors have nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/share', '/extension/', '/auth/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
