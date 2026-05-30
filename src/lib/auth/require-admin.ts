import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDatabase } from '@/lib/db/client';
import { getSession, SESSION_COOKIE } from './session';

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    redirect('/admin/login');
  }

  const session = getSession(getDatabase(), token);

  if (!session) {
    redirect('/admin/login');
  }

  return session;
}
