import { NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db/client';
import { redirectTo } from '@/lib/http/redirect';

export async function POST(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);

  if (token) {
    deleteSession(getDatabase(), token);
  }

  const response = redirectTo(request, '/admin/login', { status: 303 });

  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return response;
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get('cookie')?.split(';') ?? [];

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');

    if (rawName === name) {
      return rawValue.join('=');
    }
  }

  return undefined;
}
