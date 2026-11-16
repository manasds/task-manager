import type { Metadata } from 'next';
import OrbitApp from '@/App';
import { CloudUser } from '@/types/document';
import { getSessionUser } from '@/lib/session';
import { SITE_DESCRIPTION, SITE_FEATURES, SITE_NAME, SITE_URL } from '@/lib/site';

// The page reads the session cookie, so it must render per request, never at build time.
export const dynamic = 'force-dynamic';

// Only the home page names itself canonical; the layout's metadata would hand it to every page.
export const metadata: Metadata = { alternates: { canonical: '/' } };

/** Structured data for search and answer engines: what Tasky is, that it is free, and what it does. */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript. Runs in any modern browser and installs as an app.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: SITE_FEATURES,
      image: `${SITE_URL}/opengraph-image`,
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
  ],
};

export default async function HomePage() {
  let user: CloudUser | null = null;
  let sessionError = false;

  try {
    // Without a session cookie this answers without touching Postgres, so visitors don't wake it.
    user = await getSessionUser();
  } catch (error) {
    // Let the client fall back to the last known user instead of failing the page.
    console.error(error);
    sessionError = true;
  }

  return (
    <>
      <script
        type="application/ld+json"
        // Escaping `<` keeps the JSON from ever closing the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, '\\u003c') }}
      />
      <OrbitApp initialUser={user} sessionError={sessionError} />
    </>
  );
}
