import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  createSession,
  createSessionToken,
  deleteSession,
  getSession,
  hashSessionToken,
  SESSION_COOKIE,
} from '@/lib/auth/session';
import { runMigrations } from '@/lib/db/migrate';
import { middleware } from '@/middleware';

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

describe('admin auth routes', () => {
  let cleanup: (() => void) | undefined;
  let originalDatabasePath: string | undefined;
  let db: Database.Database;
  let loginPost: (request: Request) => Promise<Response>;
  let logoutPost: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    originalDatabasePath = process.env.DATABASE_PATH;
    const dir = mkdtempSync(join(tmpdir(), 'notes-auth-routes-'));
    const dbPath = join(dir, 'test.sqlite');
    process.env.DATABASE_PATH = dbPath;

    const [{ getDatabase }, loginRoute, logoutRoute] = await Promise.all([
      import('@/lib/db/client'),
      import('@/app/api/admin/login/route'),
      import('@/app/api/admin/logout/route'),
    ]);

    db = getDatabase();
    loginPost = loginRoute.POST;
    logoutPost = logoutRoute.POST;
    cleanup = () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
      if (originalDatabasePath === undefined) {
        delete process.env.DATABASE_PATH;
      } else {
        process.env.DATABASE_PATH = originalDatabasePath;
      }
    };
  });

  beforeEach(() => {
    db.prepare('delete from sessions').run();
    db.prepare('delete from admin_users').run();
  });

  afterAll(() => {
    cleanup?.();
  });

  it('successful login returns 303, sets the session cookie, and stores only the token hash', async () => {
    const passwordHash = await hashPassword('strong-password');
    db.prepare(
      `
        insert into admin_users (id, username, password_hash, created_at, updated_at)
        values ('admin-id', 'admin', ?, '2026-05-31T00:00:00.000Z', '2026-05-31T00:00:00.000Z')
      `,
    ).run(passwordHash);

    const response = await loginPost(makeLoginRequest('admin', 'strong-password'));
    const setCookie = response.headers.get('set-cookie') ?? '';
    const session = db.prepare('select token_hash from sessions').get() as { token_hash: string };

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/admin');
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain('Path=/');
    expect(session.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(setCookie).not.toContain(session.token_hash);
  });

  it('failed login returns 303 to the error page and does not create a session', async () => {
    const passwordHash = await hashPassword('strong-password');
    db.prepare(
      `
        insert into admin_users (id, username, password_hash, created_at, updated_at)
        values ('admin-id', 'admin', ?, '2026-05-31T00:00:00.000Z', '2026-05-31T00:00:00.000Z')
      `,
    ).run(passwordHash);

    const response = await loginPost(makeLoginRequest('admin', 'wrong-password'));
    const sessionCount = db.prepare('select count(*) as count from sessions').get() as { count: number };

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/admin/login?error=1');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(sessionCount.count).toBe(0);
  });

  it('logout returns 303, clears the root cookie, and deletes the database session', async () => {
    const token = createSessionToken();
    createSession(db, token);

    const response = await logoutPost(
      new Request('http://localhost/api/admin/logout', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE}=${token}`,
        },
      }),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/admin/login');
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    expect(getSession(db, token)).toBeUndefined();
  });
});

describe('admin middleware prefilter', () => {
  it('redirects admin requests without a session cookie', () => {
    const response = middleware(new NextRequest('http://localhost/admin'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/admin/login');
  });

  it('passes arbitrary session cookies through only as a prefilter', () => {
    const response = middleware(
      new NextRequest('http://localhost/admin', {
        headers: {
          cookie: `${SESSION_COOKIE}=not-a-real-session`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});

function makeLoginRequest(username: string, password: string): Request {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    body: new URLSearchParams({ username, password }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
  });
}
