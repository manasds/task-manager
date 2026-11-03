import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMigrated } from '@/lib/db';
import { createExtensionToken, revokeExtensionToken } from '@/lib/extensionTokens';
import { getSessionUser } from '@/lib/session';
import { allowedExtensionIds, bearerToken, redirectExtensionId } from '@/utils/extensionAuth';

export const runtime = 'nodejs';

const bodySchema = z.object({ redirect: z.string().max(2048) });

/**
 * POST /api/extension/token with { redirect }: a key for the extension that sign-in will return to.
 * Only the signed-in web app can ask (not an extension key), and only for an approved extension.
 */
export async function POST(request: Request) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = bodySchema.safeParse(await request.json().catch(() => null));

    const extensionId = body.success
      ? redirectExtensionId(body.data.redirect, allowedExtensionIds(process.env.TASKY_EXTENSION_IDS))
      : null;

    if (!extensionId) {
      return NextResponse.json({ error: 'This extension is not allowed to connect' }, { status: 400 });
    }

    return NextResponse.json({ token: await createExtensionToken(user.id, extensionId) });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not connect the extension' }, { status: 500 });
  }
}

/** DELETE /api/extension/token with the key as a bearer token: the extension signs out and the key stops working. */
export async function DELETE(request: Request) {
  try {
    await ensureMigrated();
    const token = bearerToken(request.headers.get('authorization'));

    if (token) await revokeExtensionToken(token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not sign out' }, { status: 500 });
  }
}
