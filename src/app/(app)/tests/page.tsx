import Link from 'next/link';
import { getPartsList } from '@/lib/data';
import PartsTable from '@/components/PartsTable';
import AutoRefresh from '@/components/AutoRefresh';

export default async function TestsPage() {
  const rows = await getPartsList('test');
  return (
    <div className="space-y-5">
      <AutoRefresh />
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">ใบบันทึกผลการทดสอบ</h1>
          <p className="text-sm text-slate-500 mt-1">เก็บแยกจากเอกสาร 9 หมวด (โฟลเดอร์ [ใบบันทึกผลการทดสอบ] ใน Drive)</p>
        </div>
        <Link href="/upload?system=test" className="btn-primary">อัปโหลดใบทดสอบ</Link>
      </div>
      <PartsTable rows={rows} system="test" />
    </div>
  );
}
