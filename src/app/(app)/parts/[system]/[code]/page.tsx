import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getPartDetail } from '@/lib/data';
import { normalizeSystem } from '@/lib/constants';
import PartDetailClient from './PartDetailClient';

export default async function PartPage({ params }: { params: Promise<{ system: string; code: string }> }) {
  const p = await params;
  const system = normalizeSystem(p.system);
  const code = decodeURIComponent(p.code);
  const [me, detail] = await Promise.all([getSession(), getPartDetail(system, code)]);
  if (!detail) {
    if (p.system !== 'main' && p.system !== 'test') notFound();
    return (
      <div className="card p-10 text-center">
        <p className="text-slate-600">ไม่พบชิ้นงาน “{code}” ใน{system === 'test' ? 'ใบบันทึกผลการทดสอบ' : 'เอกสารทั่วไป'}</p>
        <Link href="/search" className="btn-ghost mt-4">กลับไปค้นหา</Link>
      </div>
    );
  }
  return <PartDetailClient detail={detail} isAdmin={me?.role === 'admin'} />;
}
