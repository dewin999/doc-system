import { route, ApiError } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { UPLOAD_CHUNK_BYTES } from '@/lib/constants';
import { openTicket } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ขั้นที่ 2: รับไฟล์ทีละชิ้น (≤ 3 MB) จากเบราว์เซอร์ แล้วส่งต่อเข้า session อัปโหลดของ Drive
// แบ่งเป็นชิ้นเพราะ Vercel รับข้อมูลต่อคำขอได้ไม่เกิน 4.5 MB
export const POST = route(async (req) => {
  const me = await requireUser();
  const t = openTicket(req.headers.get('x-upload-ticket') || '', me.id);
  const offset = Number(req.nextUrl.searchParams.get('offset'));
  const buf = Buffer.from(await req.arrayBuffer());
  const len = buf.length;
  const isLast = offset + len === t.size;

  if (!Number.isInteger(offset) || offset < 0 || len === 0 || len > UPLOAD_CHUNK_BYTES || offset + len > t.size) {
    throw new ApiError(400, 'ข้อมูลไฟล์ไม่ถูกต้อง');
  }
  if (!isLast && len !== UPLOAD_CHUNK_BYTES) throw new ApiError(400, 'ข้อมูลไฟล์ไม่ถูกต้อง');

  const res = await fetch(t.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Length': String(len), 'Content-Range': `bytes ${offset}-${offset + len - 1}/${t.size}` },
    body: buf,
    signal: AbortSignal.timeout(50000)
  });

  if (res.status === 308) {
    const range = res.headers.get('range'); // "bytes=0-3145727"
    const next = range ? Number(range.split('-')[1]) + 1 : 0;
    return { success: true, next };
  }
  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new ApiError(502, 'Google Drive ไม่ส่งรหัสไฟล์กลับมา');
    return { success: true, done: true, fileId: data.id };
  }
  if (res.status === 404 || res.status === 410) throw new ApiError(410, 'การอัปโหลดหมดอายุ กรุณาเริ่มใหม่');
  throw new ApiError(502, `ส่งไฟล์เข้า Google Drive ไม่สำเร็จ (${res.status})`);
});
