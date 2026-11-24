// ค่าคงที่ที่ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์

export type SystemType = 'main' | 'test';

export const CATEGORIES: { no: number; name: string }[] = [
  { no: 1, name: 'ใบรับรองความต้องการ' },
  { no: 2, name: 'Sketch Design' },
  { no: 3, name: '3D Drawing' },
  { no: 4, name: '2D Drawing' },
  { no: 5, name: 'ใบบันทึกผลการตรวจสอบเบื้องต้น' },
  { no: 6, name: 'ใบขอทดสอบแม่พิมพ์' },
  { no: 7, name: 'ใบบันทึกผลตรวจสอบและรับรองผลิตภัณฑ์' },
  { no: 8, name: 'ใบบันทึกผลการทดสอบ' },
  { no: 9, name: 'ใบมาตรฐานสินค้าและผลิตภัณฑ์' }
];

export const TEST_CATEGORY_NAME = 'ใบบันทึกผลการทดสอบ';
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB ต่อไฟล์
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024; // ต้องเป็นผลคูณของ 256 KB (ข้อกำหนดของ Drive) และต่ำกว่าเพดาน 4.5 MB ของ Vercel
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeSystem(v: unknown): SystemType {
  return v === 'test' ? 'test' : 'main';
}

export function systemLabel(s: SystemType) {
  return s === 'test' ? 'ใบบันทึกผลการทดสอบ' : 'เอกสารทั่วไป';
}

export function categoryName(system: SystemType, no: number) {
  if (system === 'test') return TEST_CATEGORY_NAME;
  return CATEGORIES.find((c) => c.no === no)?.name ?? '';
}

// "PART 01/2" → ใช้ใน URL ได้
export function partHref(system: SystemType, code: string) {
  return `/parts/${system}/${encodeURIComponent(code)}`;
}
