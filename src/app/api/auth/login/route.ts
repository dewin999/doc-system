import { route, readJson, str } from '@/lib/http';
import { sql } from '@/lib/db';
import { logAction } from '@/lib/audit';
import {
  burnHashTime, clearLoginFails, createSession, hashPassword, isDefaultPassword, isLoginLocked,
  LOGIN_LOCK_MINUTES, MAX_LOGIN_ATTEMPTS, needsRehash, recordLoginFail, verifyPassword
} from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = route(async (req) => {
  const body = await readJson(req);
  const username = str(body.username, 200);
  const password = str(body.password, 300);
  if (!username || !password) return { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  if (username.length > 100 || password.length > 200) return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };

  if (await isLoginLocked(username)) {
    return { success: false, message: `เข้าสู่ระบบผิดเกิน ${MAX_LOGIN_ATTEMPTS} ครั้ง บัญชีนี้ถูกล็อกชั่วคราว กรุณารอ ${LOGIN_LOCK_MINUTES} นาทีแล้วลองใหม่` };
  }

  const rows = await sql`select id, username, password_hash, must_change from users where lower(username) = lower(${username})`;
  const u = rows[0];
  let reason = 'ไม่พบชื่อผู้ใช้งาน';
  if (u) {
    if (verifyPassword(password, u.password_hash)) {
      const mustChange = !!u.must_change || isDefaultPassword(password);
      if (needsRehash(u.password_hash) || mustChange !== !!u.must_change) {
        await sql`update users set password_hash = ${needsRehash(u.password_hash) ? hashPassword(password) : u.password_hash},
                  must_change = ${mustChange}, updated_at = now() where id = ${u.id}`;
      }
      await clearLoginFails(username);
      await createSession(Number(u.id));
      await logAction(u.username, 'ล็อกอินสำเร็จ', '-', 'auth', mustChange ? 'ต้องเปลี่ยนรหัสผ่าน' : '');
      return { success: true, mustChange };
    }
    reason = 'รหัสผ่านไม่ถูกต้อง';
  } else {
    burnHashTime(password);
  }

  const count = await recordLoginFail(username);
  if (count >= MAX_LOGIN_ATTEMPTS) {
    await logAction(username, 'ล็อกบัญชีชั่วคราว', '-', 'auth', `login ผิด ${count} ครั้ง (${reason})`);
    return { success: false, message: `เข้าสู่ระบบผิดเกิน ${MAX_LOGIN_ATTEMPTS} ครั้ง บัญชีนี้ถูกล็อกชั่วคราว กรุณารอ ${LOGIN_LOCK_MINUTES} นาทีแล้วลองใหม่` };
  }
  await logAction(username, 'ล็อกอินไม่สำเร็จ', '-', 'auth', `${reason} (ครั้งที่ ${count})`);
  return { success: false, message: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลืออีก ${MAX_LOGIN_ATTEMPTS - count} ครั้งก่อนถูกล็อกชั่วคราว)` };
});
