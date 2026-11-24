'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Icon from './Icon';
import { CATEGORIES, partHref, type SystemType } from '@/lib/constants';
import { fmtDateTime, fmtWhen } from '@/lib/format';

export type Row = { partCode: string; partName: string; cats: number[]; lastAt: string; files: number };
const PAGE = 50;

// กันสูตรใน Excel (CSV injection) และ escape เครื่องหมายคำพูด
function csvCell(v: unknown) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export default function PartsTable({ rows, system }: { rows: Row[]; system: SystemType }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'full' | 'incomplete'>('all');
  const [page, setPage] = useState(1);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (k && !r.partCode.toLowerCase().includes(k) && !r.partName.toLowerCase().includes(k)) return false;
      if (system === 'main' && filter === 'full' && r.cats.length < 9) return false;
      if (system === 'main' && filter === 'incomplete' && r.cats.length >= 9) return false;
      return true;
    });
  }, [rows, q, filter, system]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * PAGE, cur * PAGE);

  function exportCsv() {
    const head = system === 'main'
      ? ['รหัสชิ้นงาน', 'ชื่อชิ้นงาน', 'จำนวนหมวดที่มี', ...CATEGORIES.map((c) => `${c.no}. ${c.name}`), 'จำนวนไฟล์', 'อัปเดตล่าสุด']
      : ['รหัสชิ้นงาน', 'ชื่อชิ้นงาน', 'จำนวนไฟล์', 'อัปเดตล่าสุด'];
    const body = list.map((r) => system === 'main'
      ? [r.partCode, r.partName, r.cats.length, ...CATEGORIES.map((c) => (r.cats.includes(c.no) ? '✓' : '')), r.files, fmtDateTime(r.lastAt)]
      : [r.partCode, r.partName, r.files, fmtDateTime(r.lastAt)]);
    const csv = '﻿' + [head, ...body].map((l) => l.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${system === 'main' ? 'รายการเอกสาร' : 'ใบบันทึกผลการทดสอบ'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="card">
      <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-slate-100">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="ค้นหารหัสหรือชื่อชิ้นงาน" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        {system === 'main' && (
          <select className="input sm:w-48" value={filter} onChange={(e) => { setFilter(e.target.value as typeof filter); setPage(1); }}>
            <option value="all">ทั้งหมด</option>
            <option value="full">ครบ 9 หมวด</option>
            <option value="incomplete">ยังไม่ครบ</option>
          </select>
        )}
        <button type="button" onClick={exportCsv} className="btn-ghost" disabled={!list.length}><Icon name="download" size={18} />ส่งออก CSV</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">รหัสชิ้นงาน</th>
              <th className="px-4 py-3 font-medium">ชื่อชิ้นงาน</th>
              {system === 'main' && <th className="px-4 py-3 font-medium">หมวดเอกสาร</th>}
              <th className="px-4 py-3 font-medium text-right">ไฟล์</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.partCode} className="hover:bg-emerald-50/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link href={partHref(system, r.partCode)} className="text-emerald-800 hover:underline">{r.partCode}</Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.partName || '-'}</td>
                {system === 'main' && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5" aria-label={`มี ${r.cats.length} จาก 9 หมวด`}>
                        {CATEGORIES.map((c) => (
                          <span key={c.no} title={`${c.no}. ${c.name}`}
                            className={`w-2.5 h-5 rounded-sm ${r.cats.includes(c.no) ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <span className={`text-xs font-semibold ${r.cats.length >= 9 ? 'text-emerald-700' : 'text-slate-500'}`}>{r.cats.length}/9</span>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right">{r.files}</td>
                <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">{fmtWhen(r.lastAt)}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">{rows.length ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 flex items-center justify-between text-sm text-slate-500 border-t border-slate-100">
        <span>{list.length.toLocaleString('th-TH')} รายการ</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost px-3 py-1.5" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>ก่อนหน้า</button>
            <span>หน้า {cur} / {pages}</span>
            <button type="button" className="btn-ghost px-3 py-1.5" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>ถัดไป</button>
          </div>
        )}
      </div>
    </div>
  );
}
