// Simple JSON-file persistence. Replace this module with a real database later;
// route handlers only call the functions exported here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// REPLYFLOW_DB_PATH lets tests use a throwaway file instead of the real database.
const DB_PATH = process.env.REPLYFLOW_DB_PATH || path.join(here, 'db.json');

const emptyDb = () => ({ leads: [], messages: [], followups: [], settings: null });

let cache = null;

export function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    cache = emptyDb();
  }
  return cache;
}

export function save() {
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function replaceAll(data) {
  cache = data;
  save();
}
