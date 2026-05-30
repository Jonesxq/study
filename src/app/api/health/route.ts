import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/client';

export function GET() {
  getDatabase().prepare('select 1').get();

  return NextResponse.json({ ok: true });
}
