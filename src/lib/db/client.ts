import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate';

let database: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  const dbPath = process.env.DATABASE_PATH ?? './data/notes.sqlite';
  mkdirSync(dirname(dbPath), { recursive: true });

  database = new Database(dbPath);
  database.pragma('foreign_keys = ON');
  runMigrations(database);

  return database;
}
