import { NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db';
import { getDocument, saveDocument } from '@/lib/documents';
import { getSessionUser } from '@/lib/session';
import { isValidDocument } from '@/utils/syncPolicy';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensureMigrated();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const record = await getDocument(user.id);
    return NextResponse.json({ record });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not load document' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const body = await request.json();
    const document = body?.document;
    const baseRevision = Number(body?.baseRevision);
    if (!isValidDocument(document) || !Number.isFinite(baseRevision) || baseRevision < 0) {
      return NextResponse.json({ error: 'Invalid document payload' }, { status: 400 });
    }
    const result = await saveDocument(user.id, document, baseRevision);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Revision conflict', record: result.conflict },
        { status: 409 }
      );
    }
    return NextResponse.json({ record: result.record });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save document' }, { status: 500 });
  }
}
