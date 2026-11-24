import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { clearLoginFails, hashPassword, requireUser, revokeUserSessions, validateNewPassword } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export const runtime = 'nodejs';

// เฉพาะ admin: ตั้งรหัสชั่วคราวให้ผู้ใช้อื่น — ผู้ใช้ถูกออกจากระบบ และต้องตั้งรหัสใหม่ตอน login
export const POST = route(async (req) => {
  const me = await requireUser({ admin: true });
  const b = await readJson(req);
  const t = (await sql`select id, username from users where lower(username) = lower(${str(b.username, 100)})`)[0];
  if (!t) throw new ApiError(404, 'ไม่พบผู้ใช้นี้');
  if (Number(t.id) === me.id) throw new ApiError(400, 'รีเซ็ตรหัสผ่านของตัวเองไม่ได้ — ใช้ปุ่ม "เปลี่ยนรหัสผ่าน" แทน');
  const password = typeof b.password === 'string' ? b.password : '';
  const err = validateNewPassword(password, t.username);
  if (err) throw new ApiError(400, err);

  await sql`update users set password_hash = ${hashPassword(password)}, must_change = true, updated_at = now() where id = ${t.id}`;
  await revokeUserSessions(Number(t.id));
  await clearLoginFails(t.username);
  await logAction(me.name, 'รีเซ็ตรหัสผ่าน', '-', 'auth', t.username);
  return { success: true, message: `รีเซ็ตรหัสผ่านของ "${t.username}" แล้ว — แจ้งรหัสชั่วคราวให้ผู้ใช้` };
});
