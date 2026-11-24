import 'server-only';
import crypto from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { sql } from './db';
import { ApiError } from './http';

export const SESSION_COOKIE = 'dt_session';
const IDLE_MS = 6 * 3600 * 1000;      // หมดอายุเมื่อไม่ใช้งานเกิน 6 ชม. (ต่ออายุเองเมื่อใช้งาน)
const MAX_MS = 24 * 3600 * 1000;      // อายุสูงสุดนับจาก login 24 ชม.
const RENEW_MS = 30 * 60 * 1000;      // ต่ออายุไม่ถี่กว่าทุก 30 นาที
const HASH_ITERATIONS = 60000;        // รหัสผ่านที่ตั้งในระบบใหม่ (ระบบเดิมใช้ 1000 — จะเข้ารหัสใหม่เองตอน login)
const DEFAULT_PASSWORDS = ['admin123', 'user123'];
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;

export type SessionUser = {
  id: number;
  username: string;
  role: 'admin' | 'user';
  name: string;
  mustChange: boolean;
  tokenHash: string;
};

const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- รหัสผ่าน (รองรับรูปแบบเดียวกับระบบ Apps Script เดิม) ----------
// v2: "v2$<รอบ>$<salt 16 hex>$<hash 64 hex>" = HMAC-SHA256(password, key=salt) วนซ้ำตามจำนวนรอบ
function stretch(password: string, salt: string, iterations: number) {
  const key = Buffer.from(salt, 'utf8');
  let h = crypto.createHmac('sha256', key).update(Buffer.from(password, 'utf8')).digest();
  for (let i = 1; i < iterations; i++) h = crypto.createHmac('sha256', key).update(h).digest();
  return h.toString('hex');
}

function parseV2(stored: string) {
  const m = /^v2\$(\d{1,7})\$([0-9a-f]{16})\$([0-9a-f]{64})$/.exec(stored);
  return m ? { iterations: Number(m[1]), salt: m[2], hash: m[3] } : null;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(8).toString('hex');
  return `v2$${HASH_ITERATIONS}$${salt}$${stretch(password, salt, HASH_ITERATIONS)}`;
}

export function verifyPassword(password: string, stored: string) {
  stored = String(stored || '');
  const v2 = parseV2(stored);
  if (v2) return v2.iterations >= 1 && safeEqual(stretch(password, v2.salt, v2.iterations), v2.hash);
  if (/^[0-9a-f]{64}:[0-9a-f]{16}$/.test(stored)) {           // ระบบเดิมรุ่นแรก: sha256(password + salt)
    const [hash, salt] = stored.split(':');
    return safeEqual(sha256(password + salt), hash);
  }
  if (/^[0-9a-f]{40}$/.test(stored)) {                        // sha1 ไม่ใส่ salt (พบในชีต Users เดิม)
    return safeEqual(crypto.createHash('sha1').update(password).digest('hex'), stored) || safeEqual(stored, password);
  }
  return stored !== '' && safeEqual(stored, password);        // ข้อความธรรมดา (เก่ามาก)
}

export function needsRehash(stored: string) {
  const v2 = parseV2(String(stored || ''));
  return !v2 || v2.iterations < HASH_ITERATIONS;
}

export function isDefaultPassword(pw: string) {
  return DEFAULT_PASSWORDS.includes(pw);
}

// ใช้ตอนไม่พบชื่อผู้ใช้ เพื่อให้เวลาตอบสนองใกล้เคียงกับกรณีพบ (กันเดาชื่อผู้ใช้จากเวลา)
export function burnHashTime(password: string) {
  stretch(password, '0000000000000000', HASH_ITERATIONS);
}

export function validateNewPassword(p: string, username: string): string | null {
  if (p !== p.trim()) return 'รหัสผ่านต้องไม่ขึ้นต้นหรือลงท้ายด้วยช่องว่าง';
  if (p.length < 8) return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
  if (p.length > 200) return 'รหัสผ่านยาวเกินไป';
  if (p.toLowerCase() === username.trim().toLowerCase()) return 'รหัสผ่านต้องไม่เหมือนชื่อผู้ใช้';
  if (isDefaultPassword(p)) return 'ห้ามใช้รหัสผ่านเริ่มต้นของระบบ';
  return null;
}

// ---------- จำกัดการ login ผิด (นับต่อชื่อผู้ใช้) ----------
const failKey = (username: string) => sha256(username.trim().toLowerCase() + '|login');

export async function isLoginLocked(username: string) {
  const r = await sql`select fail_count from login_failures where username_key = ${failKey(username)} and expires_at > now()`;
  return (r[0]?.fail_count ?? 0) >= MAX_LOGIN_ATTEMPTS;
}

export async function recordLoginFail(username: string): Promise<number> {
  const r = await sql`
    insert into login_failures (username_key, fail_count, expires_at)
    values (${failKey(username)}, 1, now() + make_interval(mins => ${LOGIN_LOCK_MINUTES}))
    on conflict (username_key) do update set
      fail_count = case when login_failures.expires_at > now() then login_failures.fail_count + 1 else 1 end,
      expires_at = now() + make_interval(mins => ${LOGIN_LOCK_MINUTES})
    returning fail_count`;
  return r[0].fail_count as number;
}

export async function clearLoginFails(username: string) {
  await sql`delete from login_failures where username_key = ${failKey(username)}`;
}

// ---------- session ----------
// token แบบสุ่มเก็บในคุกกี้ httpOnly ส่วนฐานข้อมูลเก็บแค่ sha256 ของ token
export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  await sql`delete from sessions where expires_at < now()`;
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${userId}, now() + make_interval(secs => ${IDLE_MS / 1000}))`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_MS / 1000
  });
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const tokenHash = sha256(token);
  const rows = await sql`
    select s.created_at, s.renewed_at, s.expires_at, u.id, u.username, u.role, u.name, u.must_change
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}`;
  const r = rows[0];
  if (!r) return null;
  const now = Date.now();
  if (new Date(r.expires_at).getTime() <= now) {
    await sql`delete from sessions where token_hash = ${tokenHash}`;
    return null;
  }
  if (now - new Date(r.renewed_at).getTime() > RENEW_MS) {
    const newExp = Math.min(now + IDLE_MS, new Date(r.created_at).getTime() + MAX_MS);
    await sql`update sessions set renewed_at = now(), expires_at = ${new Date(newExp)} where token_hash = ${tokenHash}`;
  }
  return {
    id: Number(r.id),
    username: r.username,
    role: r.role === 'admin' ? 'admin' : 'user',
    name: r.name || r.username,
    mustChange: !!r.must_change,
    tokenHash
  };
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

// ยกเลิก session ทั้งหมดของผู้ใช้ (เว้น session ปัจจุบันได้)
export async function revokeUserSessions(userId: number, keepTokenHash?: string) {
  if (keepTokenHash) await sql`delete from sessions where user_id = ${userId} and token_hash <> ${keepTokenHash}`;
  else await sql`delete from sessions where user_id = ${userId}`;
}

// ใช้ใน API route
export async function requireUser(opts: { admin?: boolean; allowMustChange?: boolean } = {}) {
  const u = await getSession();
  if (!u) throw new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', { sessionExpired: true });
  if (u.mustChange && !opts.allowMustChange) {
    throw new ApiError(403, 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', { passwordChangeRequired: true });
  }
  if (opts.admin && u.role !== 'admin') throw new ApiError(403, 'คุณไม่มีสิทธิ์ทำรายการนี้ (เฉพาะ Admin เท่านั้น)');
  return u;
}
