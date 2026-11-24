import 'server-only';
import postgres from 'postgres';

// ต่อ Postgres ของ Supabase ตรงผ่าน "Transaction pooler" (พอร์ต 6543)
// prepare: false จำเป็นสำหรับ pooler โหมด transaction
// เก็บไว้ใน globalThis เพื่อไม่ให้สร้าง connection ใหม่ทุกครั้งที่ dev server โหลดโค้ดซ้ำ
const g = globalThis as unknown as { __sql?: postgres.Sql };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('ยังไม่ได้ตั้งค่า DATABASE_URL');
  return postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
    onnotice: () => {}
  });
}

function getSql(): postgres.Sql {
  return g.__sql ?? (g.__sql = connect());
}

// เชื่อมต่อเมื่อถูกใช้งานครั้งแรกเท่านั้น (ตอน build ไม่ต้องมี DATABASE_URL)
export const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply: (_t, _this, args) => (getSql() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const real = getSql() as unknown as Record<PropertyKey, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  }
});
