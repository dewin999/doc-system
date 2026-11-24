import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { hashPassword, requireUser, validateNewPassword } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export const runtime = 'nodejs';

// เฉพาะ admin: รายชื่อผู้ใช้ (ไม่ส่ง hash รหัสผ่านออกไป)
export const GET = route(async () => {
  await requireUser({ admin: true });
  const rows = await sql`select username, name, role, must_change from users order by lower(username)`;
  return { success: true, data: rows.map((r) => ({ username: r.username, name: r.name, role: r.role, mustChange: r.must_change })) };
});

// เฉพาะ admin: เพิ่มผู้ใช้ — ผู้ใช้ใหม่ต้องตั้งรหัสผ่านเองตอน login ครั้งแรก
export const POST = route(async (req) => {
  const me = await requireUser({ admin: true });
  const b = await readJson(req);
  const username = str(b.username, 100);
  const name = str(b.name, 200) || username;
  const role = str(b.role, 10);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
    throw new ApiError(400, 'ชื่อผู้ใช้ต้องยาว 3-30 ตัว ใช้ได้เฉพาะ a-z, A-Z, 0-9, จุด, ขีดกลาง และขีดล่าง');
  }
  if (name.length > 100) throw new ApiError(400, 'ชื่อที่แสดงยาวเกินไป (สูงสุด 100 ตัวอักษร)');
  if (role !== 'admin' && role !== 'user') throw new ApiError(400, 'สิทธิ์ต้องเป็น admin หรือ user');
  const err = validateNewPassword(password, username);
  if (err) throw new ApiError(400, err);

  const exists = await sql`select 1 from users where lower(username) = lower(${username})`;
  if (exists.length) throw new ApiError(409, 'มีชื่อผู้ใช้นี้อยู่แล้ว');
  await sql`insert into users (username, password_hash, role, name, must_change)
            values (${username}, ${hashPassword(password)}, ${role}, ${name}, true)`;
  await logAction(me.name, 'เพิ่มผู้ใช้', '-', 'auth', `${username} (${role})`);
  return { success: true, message: `เพิ่มผู้ใช้ "${username}" แล้ว — แจ้งรหัสผ่านชั่วคราวให้ผู้ใช้ ระบบจะให้ตั้งรหัสใหม่ตอนเข้าสู่ระบบครั้งแรก` };
});
