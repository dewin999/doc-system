import Link from 'next/link';
import { getDashboard } from '@/lib/data';
import { partHref } from '@/lib/constants';
import { fmtWhen, safeUrl } from '@/lib/format';
import AutoRefresh from '@/components/AutoRefresh';
import StorageCard from '@/components/StorageCard';

function Stat({ label, value, sub, href }: { label: string; value: number; sub: string; href: string }) {
  return (
    <Link href={href} className="card p-5 hover:border-emerald-400 transition block">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold mt-1 text-slate-800">{value.toLocaleString('th-TH')}</div>
      <div className="text-xs text-emerald-700 mt-2">{sub}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const d = await getDashboard();
  const { stats: s, completeness: c } = d;
  const pct = (n: number) => (c.total ? (n / c.total) * 100 : 0);
  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <h1 className="page-title">แดชบอร์ด</h1>
        <p className="text-sm text-slate-500 mt-1">ภาพรวมเอกสารทั้งหมดในระบบ</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="ชิ้นงาน (เอกสารทั่วไป)" value={s.mainParts} sub={`+${s.newMainParts} ชิ้นงานใหม่ใน 7 วัน`} href="/list" />
        <Stat label="ไฟล์เอกสารทั่วไป" value={s.mainFiles} sub="ทุกหมวดรวมกัน" href="/list" />
        <Stat label="ชิ้นงานที่มีใบทดสอบ" value={s.testParts} sub={`+${s.newTestParts} ชิ้นงานใหม่ใน 7 วัน`} href="/tests" />
        <StorageCard systemKB={s.systemKB} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">ความครบถ้วนของเอกสาร (9 หมวด)</h2>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-emerald-600" style={{ width: pct(c.full) + '%' }} />
            <div className="bg-amber-400" style={{ width: pct(c.mid) + '%' }} />
            <div className="bg-rose-400" style={{ width: pct(c.low) + '%' }} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[['bg-emerald-600', 'ครบ 9 หมวด', c.full], ['bg-amber-400', '5–8 หมวด', c.mid], ['bg-rose-400', 'น้อยกว่า 5 หมวด', c.low]].map(([color, label, n]) => (
              <li key={label as string} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="flex-1">{label}</span>
                <span className="font-semibold">{Number(n).toLocaleString('th-TH')}</span>
                <span className="text-slate-400 w-14 text-right">{pct(Number(n)).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">ชิ้นงานที่เอกสารยังไม่ครบ</h2>
            <span className="text-xs text-slate-500">ทั้งหมด {d.incompleteTotal.toLocaleString('th-TH')} ชิ้นงาน</span>
          </div>
          {d.incomplete.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">เอกสารครบทุกชิ้นงาน 🎉</p> : (
            <ul className="divide-y divide-slate-100">
              {d.incomplete.map((p) => (
                <li key={p.partCode} className="py-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={partHref('main', p.partCode)} className="font-medium text-emerald-800 hover:underline">{p.partCode}</Link>
                    <span className="text-sm text-slate-500 ml-2">{p.partName}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.missing.slice(0, 4).map((m) => <span key={m.no} className="chip bg-rose-50 text-rose-700">ขาด {m.no}. {m.name}</span>)}
                      {p.missing.length > 4 && <span className="chip bg-slate-100 text-slate-600">+{p.missing.length - 4}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-600 shrink-0">{p.filled}/9</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">อัปโหลดล่าสุด</h2>
        {d.recent.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มีไฟล์</p> : (
          <ul className="divide-y divide-slate-100">
            {d.recent.map((r, i) => (
              <li key={i} className="py-2.5 flex items-center gap-3 text-sm">
                <span className={`chip shrink-0 ${r.system === 'test' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {r.system === 'test' ? 'ใบทดสอบ' : `หมวด ${r.categoryNo}`}
                </span>
                <div className="min-w-0 flex-1">
                  <a href={safeUrl(r.fileUrl)} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline truncate block">{r.fileName}</a>
                  <div className="text-xs text-slate-500">
                    <Link href={partHref(r.system, r.partCode)} className="hover:underline">{r.partCode}</Link> · {r.uploader}
                  </div>
                </div>
                <span className="text-xs text-slate-500 shrink-0">{fmtWhen(r.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
