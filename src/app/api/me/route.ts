import { NextResponse } from 'next/server';
import { configuredDatabaseUrl, ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  if (!configuredDatabaseUrl()) {
    return NextResponse.json({ user: null });
  }
  try {
    await ensureMigrated();
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not read session' }, { status: 500 });
  }
}
