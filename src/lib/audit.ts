import 'server-only';
import { sql } from './db';

// บันทึกประวัติการกระทำสำคัญ — ไม่ทำให้งานหลักล้มเหลวแม้บันทึกไม่สำเร็จ
export async function logAction(username: string, action: string, partCode = '-', system = '-', detail = '') {
  try {
    await sql`
      insert into audit_log (username, action, part_code, system, detail)
      values (${clip(username || '-', 100)}, ${clip(action, 100)}, ${clip(partCode || '-', 200)},
              ${clip(system || '-', 20)}, ${clip(detail, 500)})`;
  } catch (e) {
    console.error('audit log failed', e);
  }
}

function clip(s: string, n: number) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) : s;
}
