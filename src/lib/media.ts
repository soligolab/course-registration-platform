import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Immagini caricate dagli admin (logo, banner, pacchetti). Stanno in UPLOAD_DIR, accanto al DB,
 * e sono servite da /media/<nome>. SVG escluso di proposito: può contenere script.
 * Il tipo si riconosce dai primi byte, non dall'estensione dichiarata dal browser.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const NAME_RE = /^[a-z0-9]+-[a-f0-9]{8}\.(png|jpg|webp|gif)$/;
const TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const;
type Ext = keyof typeof TYPES;

export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

export function sniffImage(buf: Uint8Array): Ext | null {
  const b = (i: number) => buf[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpg";
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return "gif";
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
  if (buf.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export type Upload = { url: string; name: string; size: number; uploadedAt: string };

export async function saveUpload(file: File): Promise<{ ok: true; upload: Upload } | { ok: false; error: string }> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "TOO_LARGE" };
  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) return { ok: false, error: "BAD_TYPE" };
  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), buf);
  return { ok: true, upload: { url: `/media/${name}`, name, size: buf.length, uploadedAt: new Date().toISOString() } };
}

export async function listUploads(): Promise<Upload[]> {
  let names: string[];
  try {
    names = (await readdir(uploadDir())).filter((n) => NAME_RE.test(n));
  } catch {
    return [];
  }
  const items = await Promise.all(
    names.map(async (name) => {
      const s = await stat(path.join(uploadDir(), name));
      return { url: `/media/${name}`, name, size: s.size, uploadedAt: s.mtime.toISOString() };
    }),
  );
  return items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function readUpload(name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!NAME_RE.test(name)) return null;
  try {
    const data = await readFile(path.join(uploadDir(), name));
    return { data, type: TYPES[name.split(".").pop() as Ext] };
  } catch {
    return null;
  }
}

export async function deleteUpload(name: string): Promise<boolean> {
  if (!NAME_RE.test(name)) return false;
  try {
    await unlink(path.join(uploadDir(), name));
    return true;
  } catch {
    return false;
  }
}
