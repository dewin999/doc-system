import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { normalizeSystem } from '@/lib/constants';

export const runtime = 'nodejs';

// ทั้ง user และ admin แก้ชื่อชิ้นงานได้
export const POST = route(async (req) => {
  const me = await requireUser();
  const b = await readJson(req);
  const system = normalizeSystem(b.system);
  const code = str(b.partCode, 100);
  const name = str(b.newName, 300);
  if (!code) throw new ApiError(400, 'กรุณาระบุรหัสชิ้นงาน');
  if (!name) throw new ApiError(400, 'กรุณาระบุชื่อชิ้นงานใหม่');
  if (name.length > 200) throw new ApiError(400, 'ชื่อชิ้นงานยาวเกินไป (สูงสุด 200 ตัวอักษร)');

  const old = await sql`select part_name from documents where system = ${system} and lower(part_code) = lower(${code}) and status = 'active' order by uploaded_at desc limit 1`;
  if (!old.length) throw new ApiError(404, 'ไม่พบรายการที่ต้องการแก้ไข');
  await sql`update documents set part_name = ${name} where system = ${system} and lower(part_code) = lower(${code}) and status = 'active'`;
  await logAction(me.name, 'แก้ไขชื่อชิ้นงาน', code, system, `${old[0].part_name} → ${name}`);
  return { success: true, message: 'แก้ไขชื่อชิ้นงานเรียบร้อยแล้ว' };
});
