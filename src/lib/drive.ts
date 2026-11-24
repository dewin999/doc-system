import 'server-only';
import crypto from 'node:crypto';
import { ApiError } from './http';

// เรียก Apps Script "Drive Gateway" (apps-script/DriveGateway.gs) ซึ่งทำงานในนามเจ้าของ Google Drive
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.DRIVE_GATEWAY_URL;
  const secret = process.env.DRIVE_GATEWAY_SECRET;
  if (!url || !secret) throw new ApiError(500, 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Google Drive');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain: Apps Script รับได้โดยไม่ต้อง preflight
    body: JSON.stringify({ ...payload, action, secret }),
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(30000)
  });
  const text = await res.text();
  let data: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(502, 'เชื่อมต่อ Google Drive ไม่สำเร็จ');
  }
  if (!data.ok) throw new ApiError(502, 'Google Drive: ' + (data.error || 'ไม่ทราบสาเหตุ'));
  return data as T;
}

export async function ensureFolder(system: string, partCode: string, categoryNo: number) {
  const r = await call<{ folderId: string }>('ensureFolder', { system, partCode, categoryNo });
  return r.folderId;
}

export async function createUploadSession(folderId: string, fileName: string, mimeType: string, size: number) {
  const r = await call<{ uploadUrl: string }>('createUploadSession', { folderId, fileName, mimeType, size });
  return r.uploadUrl;
}

export type DriveFile = { id: string; name: string; size: number; mimeType: string; url: string; parents: string[]; trashed: boolean };

export async function getFile(fileId: string) {
  const r = await call<{ file: DriveFile }>('getFile', { fileId });
  return r.file;
}

export async function trashFile(fileId: string) {
  if (!fileId) return;
  await call('trash', { fileId });
}

export async function getStorage() {
  return call<{ limit: number; used: number }>('storage');
}

// ---------- ตั๋วอัปโหลด (เข้ารหัส AES-256-GCM) ----------
// เก็บข้อมูลที่ตรวจแล้วตอนเริ่มอัปโหลด (โฟลเดอร์, URL ของ session ใน Drive ฯลฯ) ให้เบราว์เซอร์ถือไว้
// โดยอ่านหรือแก้ไม่ได้ — URL ของ Drive จึงไม่หลุดไปที่เบราว์เซอร์
export type UploadTicket = {
  uid: number;
  system: 'main' | 'test';
  partCode: string;
  partName: string;
  categoryNo: number;
  fileName: string;
  mimeType: string;
  size: number;
  uploadId: string;
  folderId: string;
  uploadUrl: string;
  exp: number;
};

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new ApiError(500, 'ยังไม่ได้ตั้งค่า SESSION_SECRET (ต้องยาวอย่างน้อย 32 ตัว)');
  return crypto.createHash('sha256').update(s + '|upload-ticket').digest();
}

export function sealTicket(t: UploadTicket) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(t), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}

export function openTicket(s: string, uid: number): UploadTicket {
  try {
    const buf = Buffer.from(String(s), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const t = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8')) as UploadTicket;
    if (t.uid !== uid || t.exp < Date.now()) throw new Error();
    return t;
  } catch {
    throw new ApiError(400, 'การอัปโหลดหมดอายุหรือไม่ถูกต้อง กรุณาเริ่มใหม่');
  }
}
