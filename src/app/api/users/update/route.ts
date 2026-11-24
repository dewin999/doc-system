import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser, revokeUserSessions } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export const runtime = 'nodejs';

// เฉพาะ admin: แก้ชื่อที่แสดง/สิทธิ์ — เปลี่ยนสิทธิ์ของตัวเองไม่ได้ และต้องเหลือ admin อย่างน้อย 1 คน
export const POST = route(async (req) => {
  const me = await requireUser({ admin: true });
  const b = await readJson(req);
  const username = str(b.username, 100);
  const role = str(b.role, 10);
  const t = (await sql`select id, username, name, role from users where lower(username) = lower(${username})`)[0];
  if (!t) throw new ApiError(404, 'ไม่พบผู้ใช้นี้');
  const name = str(b.name, 200) || t.username;
  if (name.length > 100) throw new ApiError(400, 'ชื่อที่แสดงยาวเกินไป (สูงสุด 100 ตัวอักษร)');
  if (role !== 'admin' && role !== 'user') throw new ApiError(400, 'สิทธิ์ต้องเป็น admin หรือ user');

  if (role !== t.role) {
    if (Number(t.id) === me.id) throw new ApiError(400, 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้');
    if (t.role === 'admin') {
      const admins = (await sql`select count(*)::int n from users where role = 'admin'`)[0].n;
      if (admins <= 1) throw new ApiError(400, 'ต้องมี admin อย่างน้อย 1 คน');
    }
  }
  await sql`update users set name = ${name}, role = ${role}, updated_at = now() where id = ${t.id}`;
  if (role !== t.role) await revokeUserSessions(Number(t.id)); // สิทธิ์ใหม่มีผลทันที: ต้อง login ใหม่
  await logAction(me.name, 'แก้ไขผู้ใช้', '-', 'auth', `${t.username}: ${t.name} (${t.role}) → ${name} (${role})`);
  return { success: true, message: `บันทึกข้อมูลผู้ใช้ "${t.username}" แล้ว` };
});
