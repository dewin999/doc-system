import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { normalizeSystem } from '@/lib/constants';
import { trashFile } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

// เฉพาะ admin: ลบชิ้นงานทั้งชิ้น (ทุกไฟล์) — ไฟล์ใน Drive ย้ายลงถังขยะ กู้คืนได้ 30 วัน
export const POST = route(async (req) => {
  const me = await requireUser({ admin: true });
  const b = await readJson(req);
  const system = normalizeSystem(b.system);
  const code = str(b.partCode, 100);
  if (!code) throw new ApiError(400, 'กรุณาระบุรหัสชิ้นงาน');

  // file_id อ่านจากฐานข้อมูลเท่านั้น ไม่รับจากเบราว์เซอร์
  const rows = await sql`
    update documents set status = 'deleted'
    where system = ${system} and lower(part_code) = lower(${code}) and status = 'active'
    returning file_id`;
  if (!rows.length) throw new ApiError(404, 'ไม่พบรายการที่จะลบ');

  let failed = 0;
  const ids = rows.map((r) => String(r.file_id)).filter(Boolean);
  for (let i = 0; i < ids.length; i += 5) {
    const res = await Promise.allSettled(ids.slice(i, i + 5).map((id) => trashFile(id)));
    failed += res.filter((x) => x.status === 'rejected').length;
  }
  await logAction(me.name, 'ลบชิ้นงานทั้งหมด', code, system, `${rows.length} ไฟล์` + (failed ? ` (ย้ายลงถังขยะไม่สำเร็จ ${failed})` : ''));
  return {
    success: true,
    message: failed
      ? `ลบชิ้นงานแล้ว แต่ย้ายไฟล์ใน Drive ลงถังขยะไม่สำเร็จ ${failed} ไฟล์`
      : 'ลบชิ้นงานและย้ายไฟล์ใน Google Drive ลงถังขยะเรียบร้อยแล้ว'
  };
});
