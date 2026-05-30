import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db/client';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    deleteSession(getDatabase(), token);
  }

  cookieStore.delete(SESSION_COOKIE);
  redirect('/admin/login');
}
