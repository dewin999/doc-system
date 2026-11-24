import { route, readJson, str, ApiError } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, MAX_FILE_BYTES, UPLOAD_CHUNK_BYTES, normalizeSystem } from '@/lib/constants';
import { createUploadSession, ensureFolder, sealTicket } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ขั้นที่ 1 ของการอัปโหลด 1 ไฟล์: ตรวจข้อมูล, เตรียมโฟลเดอร์ใน Drive, เปิด session อัปโหลด
export const POST = route(async (req) => {
  const me = await requireUser();
  const b = await readJson(req);
  const system = normalizeSystem(b.system);
  let partCode = str(b.partCode, 200);
  let partName = str(b.partName, 200);
  const fileName = str(b.fileName, 300) || 'untitled';
  const mimeType = str(b.mimeType, 150) || 'application/octet-stream';
  const size = Number(b.size);
  const uploadId = str(b.uploadId, 100);
  const categoryNo = system === 'test' ? 1 : Number(b.categoryNo);

  if (!partCode) throw new ApiError(400, 'กรุณาระบุรหัสชิ้นงาน');
  if (partCode.length > 100) throw new ApiError(400, 'รหัสชิ้นงานยาวเกินไป (สูงสุด 100 ตัวอักษร)');
  if (system === 'main' && !CATEGORIES.some((c) => c.no === categoryNo)) throw new ApiError(400, 'หมวดหมู่เอกสารไม่ถูกต้อง');
  if (!Number.isInteger(size) || size <= 0) throw new ApiError(400, `ไฟล์ "${fileName}" ว่างเปล่าหรือข้อมูลไม่ถูกต้อง`);
  if (size > MAX_FILE_BYTES) throw new ApiError(400, `ไฟล์ "${fileName}" มีขนาดเกิน 10 MB`);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(uploadId)) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง');

  // ไฟล์นี้ (uploadId เดิม) เคยบันทึกสำเร็จแล้ว — เช่น เน็ตหลุดตอนรอคำตอบแล้วกดส่งซ้ำ
  const key = `${me.id}:${uploadId}`;
  const done = await sql`select 1 from documents where upload_id = ${key}`;
  if (done.length) return { success: true, done: true };

  // ใช้ตัวสะกดรหัสชิ้นงานเดิมถ้ามีอยู่แล้ว (เช่นพิมพ์ part-001 แต่ในระบบเป็น PART-001) ไม่ให้แยกเป็น 2 ชิ้นงาน
  const existing = await sql`
    select part_code, (select part_name from documents d2
                       where d2.system = ${system} and lower(d2.part_code) = lower(${partCode}) and d2.status = 'active' and d2.part_name <> ''
                       order by uploaded_at desc limit 1) as part_name
    from documents
    where system = ${system} and lower(part_code) = lower(${partCode}) and status = 'active'
    order by uploaded_at limit 1`;
  if (existing.length) {
    partCode = existing[0].part_code;
    if (!partName) partName = existing[0].part_name || ''; // ไม่ได้กรอกชื่อ = ใช้ชื่อเดิมของชิ้นงาน
  }

  const folderId = await ensureFolder(system, partCode, categoryNo);
  const uploadUrl = await createUploadSession(folderId, fileName, mimeType, size);
  const ticket = sealTicket({
    uid: me.id, system, partCode, partName, categoryNo, fileName, mimeType, size, uploadId,
    folderId, uploadUrl, exp: Date.now() + 2 * 3600 * 1000
  });
  return { success: true, ticket, chunkSize: UPLOAD_CHUNK_BYTES };
});
