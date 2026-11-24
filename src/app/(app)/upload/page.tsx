import UploadForm from './UploadForm';
import { normalizeSystem } from '@/lib/constants';

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ system?: string; code?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">อัปโหลดเอกสาร</h1>
        <p className="text-sm text-slate-500 mt-1">ไฟล์จะถูกเก็บใน Google Drive ตามโครงสร้างโฟลเดอร์เดิม (สูงสุด 10 MB ต่อไฟล์)</p>
      </div>
      <UploadForm initialSystem={normalizeSystem(sp.system)} initialCode={(sp.code || '').slice(0, 100)} />
    </div>
  );
}
