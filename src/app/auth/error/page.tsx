'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSessionUserId } from '@/auth/client';

export default function AuthErrorPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await getSessionUserId();
        if (cancelled) return;
        if (userId) {
          setSignedIn(true);
          router.replace('/');
          return;
        }
      } catch {
        // Show the retry message below.
      }
      if (!cancelled) setSignedIn(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">Google sign-in did not finish</h1>
        <p className="mt-2 text-sm text-slate-600">
          {signedIn === null
            ? 'Checking whether you are already signed in…'
            : 'Return to the board and try Continue with Google again.'}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white"
        >
          Back to the board
        </Link>
      </div>
    </main>
  );
}
