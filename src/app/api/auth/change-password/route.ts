import { route, readJson, str } from '@/lib/http';
import { sql } from '@/lib/db';
import { logAction } from '@/lib/audit';
import {
  clearLoginFails, hashPassword, isLoginLocked, LOGIN_LOCK_MINUTES, recordLoginFail,
  requireUser, revokeUserSessions, validateNewPassword, verifyPassword
} from '@/lib/auth';

export const runtime = 'nodejs';

// เปลี่ยนรหัสผ่านของตัวเอง — ใช้ได้ทั้งตอนปกติและตอนถูกบังคับให้เปลี่ยน
// สำเร็จแล้ว session อื่นของผู้ใช้นี้ (เครื่องอื่น) จะถูกออกจากระบบ
export const POST = route(async (req) => {
  const me = await requireUser({ allowMustChange: true });
  const body = await readJson(req);
  const current = str(body.current, 300);
  const next = typeof body.next === 'string' ? body.next : '';

  if (await isLoginLocked(me.username)) {
    return { success: false, message: `ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ ${LOGIN_LOCK_MINUTES} นาทีแล้วลองใหม่` };
  }
  const row = (await sql`select password_hash from users where id = ${me.id}`)[0];
  if (!row || !verifyPassword(current, row.password_hash)) {
    const n = await recordLoginFail(me.username);
    await logAction(me.username, 'เปลี่ยนรหัสผ่านไม่สำเร็จ', '-', 'auth', `รหัสผ่านปัจจุบันไม่ถูกต้อง (ครั้งที่ ${n})`);
    return { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
  }
  const err = validateNewPassword(next, me.username);
  if (err) return { success: false, message: err };
  if (next === current) return { success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' };

  await sql`update users set password_hash = ${hashPassword(next)}, must_change = false, updated_at = now() where id = ${me.id}`;
  await revokeUserSessions(me.id, me.tokenHash);
  await clearLoginFails(me.username);
  await logAction(me.username, 'เปลี่ยนรหัสผ่าน', '-', 'auth');
  return { success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
});
