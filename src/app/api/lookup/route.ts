import { route, str } from '@/lib/http';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, normalizeSystem } from '@/lib/constants';

export const runtime = 'nodejs';

// ใช้ในหน้าอัปโหลด: บอกว่ารหัสชิ้นงานนี้มีเอกสารเดิมหมวดไหนแล้ว และมีในอีกระบบหรือไม่
export const GET = route(async (req) => {
  await requireUser();
  const system = normalizeSystem(req.nextUrl.searchParams.get('system'));
  const code = str(req.nextUrl.searchParams.get('code'), 100);
  if (!code) return { success: true, data: null };
  const other = system === 'test' ? 'main' : 'test';
  const rows = await sql`
    select system, part_code, part_name, category_no, uploaded_at
    from documents where lower(part_code) = lower(${code}) and status = 'active'
    order by uploaded_at desc`;
  const mine = rows.filter((r) => r.system === system);
  const theirs = rows.filter((r) => r.system === other);
  const filled = [...new Set(mine.map((r) => Number(r.category_no)))].sort((a, b) => a - b);
  return {
    success: true,
    data: {
      exists: mine.length > 0,
      partCode: mine[0]?.part_code ?? null,
      partName: mine[0]?.part_name ?? '',
      filled: system === 'test' ? (mine.length ? [{ no: 1, name: 'ใบบันทึกผลการทดสอบ' }] : [])
        : filled.map((no) => ({ no, name: CATEGORIES.find((c) => c.no === no)?.name ?? '' })),
      files: mine.length,
      other: theirs.length ? { system: other, partName: theirs[0].part_name } : null
    }
  };
});
