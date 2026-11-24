'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { formatBytes } from '@/lib/format';

export default function StorageCard({ systemKB }: { systemKB: number }) {
  const [s, setS] = useState<{ limit: number; used: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api<{ limit: number; used: number }>('/api/storage').then((r) => (r.success ? setS({ limit: r.limit, used: r.used }) : setErr(true)));
  }, []);
  const pct = s && s.limit > 0 ? Math.min((s.used / s.limit) * 100, 100) : 0;
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">พื้นที่ Google Drive</div>
      {s ? (
        <>
          <div className="text-xl font-bold mt-1">
            {formatBytes(s.used)} <span className="text-sm font-normal text-slate-500">/ {s.limit > 0 ? formatBytes(s.limit) : 'ไม่จำกัด'}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 mt-3 overflow-hidden">
            <div className={`h-full rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: pct + '%' }} />
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-400 mt-2">{err ? 'ดึงข้อมูลไม่สำเร็จ' : 'กำลังโหลด...'}</div>
      )}
      <div className="text-xs text-slate-500 mt-3">ไฟล์ในระบบนี้ใช้ไป {formatBytes(systemKB * 1024)}</div>
    </div>
  );
}
