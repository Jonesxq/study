import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  createSession,
  createSessionToken,
  deleteSession,
  getSession,
  hashSessionToken,
} from '@/lib/auth/session';
import { runMigrations } from '@/lib/db/migrate';

function createDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'notes-auth-'));
  const db = new Database(join(dir, 'test.sqlite'));
  runMigrations(db);

  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('admin auth', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('strong-password');

    expect(hash).not.toBe('strong-password');
    await expect(verifyPassword('strong-password', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('strong-password');

    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('hashes session tokens with sha256 hex', () => {
    const hash = hashSessionToken('session-token');

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates random session tokens', () => {
    expect(createSessionToken()).not.toBe(createSessionToken());
  });

  it('stores only the hashed session token and reads active sessions', () => {
    const { db, cleanup } = createDatabase();

    try {
      const token = createSessionToken();
      const expires = createSession(db, token);
      const row = db.prepare('select token_hash, expires_at from sessions').get() as {
        token_hash: string;
        expires_at: string;
      };

      expect(row.token_hash).toBe(hashSessionToken(token));
      expect(row.token_hash).not.toBe(token);
      expect(row.expires_at).toBe(expires.toISOString());
      expect(getSession(db, token)).toMatchObject({ token_hash: row.token_hash });
    } finally {
      cleanup();
    }
  });

  it('does not read expired sessions', () => {
    const { db, cleanup } = createDatabase();

    try {
      const token = createSessionToken();
      createSession(db, token, new Date(Date.now() - 1000));

      expect(getSession(db, token)).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('deletes sessions by token', () => {
    const { db, cleanup } = createDatabase();

    try {
      const token = createSessionToken();
      createSession(db, token);
      deleteSession(db, token);

      expect(getSession(db, token)).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
