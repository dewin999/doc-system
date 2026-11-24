'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { partHref, type SystemType } from '@/lib/constants';

type P = { partCode: string; partName: string; files: number };

export default function SearchClient({ main, test }: { main: P[]; test: P[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sys, setSys] = useState<SystemType>('main');
  const src = sys === 'main' ? main : test;
  const k = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!k) return [];
    const exact = src.filter((p) => p.partCode.toLowerCase() === k);
    const rest = src.filter((p) => p.partCode.toLowerCase() !== k && (p.partCode.toLowerCase().includes(k) || p.partName.toLowerCase().includes(k)));
    return [...exact, ...rest].slice(0, 30);
  }, [src, k]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hits[0]) router.push(partHref(sys, hits[0].partCode));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex rounded-xl bg-slate-100 p-1 shrink-0">
          {(['main', 'test'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSys(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${sys === s ? 'bg-white shadow text-emerald-800' : 'text-slate-600'}`}>
              {s === 'main' ? 'เอกสารทั่วไป' : 'ใบทดสอบ'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus className="input pl-10" placeholder="พิมพ์รหัสหรือชื่อชิ้นงาน แล้วกด Enter" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </form>

      {k && (
        <div className="card divide-y divide-slate-100">
          {hits.length === 0 && <p className="p-8 text-center text-sm text-slate-400">ไม่พบชิ้นงาน “{q.trim()}” ใน{sys === 'main' ? 'เอกสารทั่วไป' : 'ใบทดสอบ'}</p>}
          {hits.map((p) => (
            <Link key={p.partCode} href={partHref(sys, p.partCode)} className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50/50">
              <Icon name="file" className="text-emerald-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.partCode}</div>
                <div className="text-sm text-slate-500 truncate">{p.partName || '-'}</div>
              </div>
              <span className="text-xs text-slate-500">{p.files} ไฟล์</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
