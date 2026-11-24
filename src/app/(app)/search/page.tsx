import { getPartsList } from '@/lib/data';
import SearchClient from './SearchClient';

export default async function SearchPage() {
  const [main, test] = await Promise.all([getPartsList('main'), getPartsList('test')]);
  const slim = (r: { partCode: string; partName: string; files: number }) => ({ partCode: r.partCode, partName: r.partName, files: r.files });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">ค้นหา / แก้ไข</h1>
        <p className="text-sm text-slate-500 mt-1">ค้นหาชิ้นงานเพื่อดูไฟล์ แก้ชื่อชิ้นงาน หรือลบเอกสาร</p>
      </div>
      <SearchClient main={main.map(slim)} test={test.map(slim)} />
    </div>
  );
}
