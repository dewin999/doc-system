import { route, readJson, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { trashFile } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 30;

// เฉพาะ admin: ลบไฟล์เดี่ยว — อ้างอิงด้วย id ในฐานข้อมูล แล้วอ่าน file_id ของ Drive จากฐานข้อมูลเอง
export const POST = route(async (req) => {
  const me = await requireUser({ admin: true });
  const b = await readJson(req);
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง');

  const rows = await sql`update documents set status = 'deleted' where id = ${id} and status = 'active'
                         returning system, part_code, file_name, file_id`;
  if (!rows.length) throw new ApiError(404, 'รายการนี้ถูกลบไปแล้ว กรุณาโหลดหน้าใหม่');
  const r = rows[0];
  let note = '';
  try { await trashFile(r.file_id); } catch { note = ' (ย้ายไฟล์ใน Drive ลงถังขยะไม่สำเร็จ)'; }
  await logAction(me.name, 'ลบเอกสารเดี่ยว', r.part_code, r.system, r.file_name + note);
  return { success: true, message: 'ลบเอกสารเรียบร้อยแล้ว' + note };
});
