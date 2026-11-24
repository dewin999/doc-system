import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { categoryName } from '@/lib/constants';
import { getFile, openTicket, trashFile } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ขั้นที่ 3: ยืนยันกับ Drive ว่าไฟล์อยู่ในโฟลเดอร์ที่ถูกต้องจริง แล้วบันทึกลงฐานข้อมูล
export const POST = route(async (req) => {
  const me = await requireUser();
  const b = await readJson(req, 8192);
  const t = openTicket(str(b.ticket, 4000), me.id);
  const fileId = str(b.fileId, 200);
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง');

  const f = await getFile(fileId);
  if (f.trashed || !f.parents.includes(t.folderId) || Number(f.size) !== t.size) {
    throw new ApiError(400, 'ตรวจสอบไฟล์ใน Google Drive ไม่ผ่าน กรุณาอัปโหลดใหม่');
  }

  const inserted = await sql`
    insert into documents (system, part_code, part_name, category_no, category_name, file_name, file_url, file_id,
                           mime_type, size_kb, uploader, upload_id)
    values (${t.system}, ${t.partCode}, ${t.partName}, ${t.categoryNo}, ${categoryName(t.system, t.categoryNo)},
            ${t.fileName}, ${f.url}, ${f.id}, ${t.mimeType}, ${Math.round(t.size / 1024)}, ${me.name},
            ${`${me.id}:${t.uploadId}`})
    on conflict (upload_id) do nothing
    returning id`;

  if (inserted.length === 0) {
    // ไฟล์นี้ถูกบันทึกไปแล้วจากคำขอก่อนหน้า — ทิ้งไฟล์ที่ซ้ำ
    await trashFile(f.id).catch(() => {});
    return { success: true, duplicate: true };
  }

  // ชื่อชิ้นงานใหม่ที่กรอกมา: ใช้กับไฟล์เดิมของชิ้นงานนี้ด้วยให้ตรงกัน
  if (t.partName) {
    await sql`update documents set part_name = ${t.partName}
              where system = ${t.system} and lower(part_code) = lower(${t.partCode}) and status = 'active' and part_name = ''`;
  }
  await logAction(me.name, 'อัปโหลดเอกสาร', t.partCode, t.system, t.fileName);
  return { success: true };
});
