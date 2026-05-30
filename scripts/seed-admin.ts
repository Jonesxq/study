import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/lib/auth/password';
import { getDatabase } from '../src/lib/db/client';

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.error('ADMIN_USERNAME and ADMIN_PASSWORD are required');
  process.exit(1);
}

const db = getDatabase();
const now = new Date().toISOString();
const passwordHash = await hashPassword(password);

db.prepare(
  `
    insert into admin_users (id, username, password_hash, created_at, updated_at)
    values (@id, @username, @passwordHash, @createdAt, @updatedAt)
    on conflict(username) do update set
      password_hash = excluded.password_hash,
      updated_at = excluded.updated_at
  `,
).run({
  id: randomUUID(),
  username,
  passwordHash,
  createdAt: now,
  updatedAt: now,
});

console.log(`Admin user seeded: ${username}`);
