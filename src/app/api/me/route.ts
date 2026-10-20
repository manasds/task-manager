import { NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensureMigrated();
    return NextResponse.json({ user: await getSessionUser() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not read session' }, { status: 500 });
  }
}
