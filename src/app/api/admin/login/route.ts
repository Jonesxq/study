import { NextResponse } from 'next/server';
import { createSession, createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { getDatabase } from '@/lib/db/client';

type AdminUserRow = {
  password_hash: string;
};

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const db = getDatabase();
  const user = db.prepare('select password_hash from admin_users where username = ?').get(username) as
    | AdminUserRow
    | undefined;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), { status: 303 });
  }

  const token = createSessionToken();
  const expires = createSession(db, token);
  const response = NextResponse.redirect(new URL('/admin', request.url), { status: 303 });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  });

  return response;
}
