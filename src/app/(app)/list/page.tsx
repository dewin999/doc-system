import Link from 'next/link';
import { getPartsList } from '@/lib/data';
import PartsTable from '@/components/PartsTable';
import AutoRefresh from '@/components/AutoRefresh';

export default async function ListPage() {
  const rows = await getPartsList('main');
  return (
    <div className="space-y-5">
      <AutoRefresh />
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">รายการเอกสารทั้งหมด</h1>
          <p className="text-sm text-slate-500 mt-1">ชิ้นงานและเอกสาร 9 หมวด เรียงตามการอัปเดตล่าสุด</p>
        </div>
        <Link href="/upload" className="btn-primary">อัปโหลด</Link>
      </div>
      <PartsTable rows={rows} system="main" />
    </div>
  );
}
