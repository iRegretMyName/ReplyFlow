// Image uploads for the website (course pictures, hero and about photos).
// Files are accepted only if their actual bytes are a JPEG, PNG or WebP (the browser's claimed
// type and the file name are never trusted), under a size limit. Each is stored under a random
// name, so nothing a visitor or administrator types ever becomes part of a file path.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = () => process.env.REPLYFLOW_UPLOAD_DIR || path.join(here, '..', 'uploads');
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null; // SVG, GIF, HTML, scripts and anything else are refused
}

export function saveImage(buf) {
  const ext = sniffImage(buf);
  if (!ext) return null;
  fs.mkdirSync(uploadDir(), { recursive: true });
  const name = `${randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadDir(), name), buf, { flag: 'wx' });
  return name;
}

export const imageExists = (name) => NAME_RE.test(name) && fs.existsSync(path.join(uploadDir(), name));

export function removeImage(name) {
  if (NAME_RE.test(name || '')) fs.rmSync(path.join(uploadDir(), name), { force: true });
}

// Deletes files nothing refers to any more (for example an image uploaded and then abandoned).
// Files from the last hour are kept, in case someone is mid-edit.
export function pruneUploads(inUse) {
  let removed = 0;
  let names = [];
  try { names = fs.readdirSync(uploadDir()); } catch { return 0; }
  for (const name of names) {
    if (!NAME_RE.test(name) || inUse.has(name)) continue;
    const file = path.join(uploadDir(), name);
    if (Date.now() - fs.statSync(file).mtimeMs < 3_600_000) continue;
    fs.rmSync(file, { force: true });
    removed += 1;
  }
  return removed;
}
