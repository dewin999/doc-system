import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export const runtime = 'nodejs';

// เฉพาะ admin: ลบผู้ใช้ (session ของผู้ใช้นั้นถูกลบตามไปด้วย) — ลบตัวเองหรือ admin คนสุดท้ายไม่ได้
export const POST = route(async (req) => {
  const me = await requireUser({ admin: true });
  const b = await readJson(req);
  const t = (await sql`select id, username, role from users where lower(username) = lower(${str(b.username, 100)})`)[0];
  if (!t) throw new ApiError(404, 'ไม่พบผู้ใช้นี้');
  if (Number(t.id) === me.id) throw new ApiError(400, 'ลบบัญชีของตัวเองไม่ได้');
  if (t.role === 'admin') {
    const admins = (await sql`select count(*)::int n from users where role = 'admin'`)[0].n;
    if (admins <= 1) throw new ApiError(400, 'ต้องมี admin อย่างน้อย 1 คน');
  }
  await sql`delete from users where id = ${t.id}`;
  await logAction(me.name, 'ลบผู้ใช้', '-', 'auth', `${t.username} (${t.role})`);
  return { success: true, message: `ลบผู้ใช้ "${t.username}" แล้ว` };
});
