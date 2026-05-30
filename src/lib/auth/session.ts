import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database as DatabaseConnection } from 'better-sqlite3';

export const SESSION_COOKIE = 'notes_admin_session';

export type SessionRecord = {
  id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: DatabaseConnection, token: string, expires = defaultSessionExpires()): Date {
  const now = new Date();

  db.prepare(
    `
      insert into sessions (id, token_hash, expires_at, created_at)
      values (@id, @tokenHash, @expiresAt, @createdAt)
    `,
  ).run({
    id: randomUUID(),
    tokenHash: hashSessionToken(token),
    expiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
  });

  return expires;
}

export function getSession(db: DatabaseConnection, token: string): SessionRecord | undefined {
  return db
    .prepare('select * from sessions where token_hash = ? and expires_at > ?')
    .get(hashSessionToken(token), new Date().toISOString()) as SessionRecord | undefined;
}

export function deleteSession(db: DatabaseConnection, token: string): void {
  db.prepare('delete from sessions where token_hash = ?').run(hashSessionToken(token));
}

function defaultSessionExpires(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}
