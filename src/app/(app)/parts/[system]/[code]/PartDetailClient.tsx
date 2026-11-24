'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Modal, { ConfirmModal } from '@/components/Modal';
import { api, toast } from '@/lib/client';
import { fmtDateTime, formatBytes, safeUrl } from '@/lib/format';
import type { PartDetail } from '@/lib/data';

type Pending = { kind: 'file'; id: number; name: string } | { kind: 'part' } | null;

export default function PartDetailClient({ detail, isAdmin }: { detail: PartDetail; isAdmin: boolean }) {
  const router = useRouter();
  const d = detail;
  const total = d.categories.reduce((n, c) => n + c.files.length, 0);
  const filled = d.categories.filter((c) => c.files.length).length;
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(d.partName);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    const r = await api('/api/parts/rename', { system: d.system, partCode: d.partCode, newName: newName.trim() });
    setBusy(false);
    toast(r.message || (r.success ? 'บันทึกแล้ว' : 'ไม่สำเร็จ'), r.success ? 'success' : 'error');
    if (r.success) { setRenaming(false); router.refresh(); }
  }

  async function doDelete() {
    if (!pending) return;
    setBusy(true);
    const r = pending.kind === 'file'
      ? await api('/api/documents/delete', { id: pending.id })
      : await api('/api/parts/delete', { system: d.system, partCode: d.partCode });
    setBusy(false);
    setPending(null);
    toast(r.message || (r.success ? 'ลบแล้ว' : 'ไม่สำเร็จ'), r.success ? 'success' : 'error');
    if (!r.success) return;
    if (pending.kind === 'part' || total <= 1) router.push(d.system === 'test' ? '/tests' : '/list');
    router.refresh();
  }

  const uploadHref = `/upload?system=${d.system}&code=${encodeURIComponent(d.partCode)}`;

  return (
    <div className="space-y-5">
      <div className="text-sm text-slate-500">
        <Link href={d.system === 'test' ? '/tests' : '/list'} className="hover:underline">
          {d.system === 'test' ? 'ใบบันทึกผลการทดสอบ' : 'รายการทั้งหมด'}
        </Link> / {d.partCode}
      </div>

      <div className="card p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{d.partCode}</h1>
            <span className={`chip ${d.system === 'test' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {d.system === 'test' ? 'ใบทดสอบ' : `${filled}/9 หมวด`}
            </span>
          </div>
          <div className="text-slate-600 mt-1 flex items-center gap-2">
            <span>{d.partName || <span className="text-slate-400">ไม่มีชื่อชิ้นงาน</span>}</span>
            <button type="button" onClick={() => { setNewName(d.partName); setRenaming(true); }} className="text-slate-400 hover:text-emerald-700" aria-label="แก้ไขชื่อชิ้นงาน">
              <Icon name="edit" size={16} />
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-1">{total} ไฟล์</div>
        </div>
        <div className="flex gap-2">
          <Link href={uploadHref} className="btn-primary"><Icon name="upload" size={18} />อัปโหลดเพิ่ม</Link>
          {isAdmin && <button type="button" onClick={() => setPending({ kind: 'part' })} className="btn bg-red-50 text-red-700 hover:bg-red-100"><Icon name="trash" size={18} />ลบชิ้นงาน</button>}
        </div>
      </div>

      <div className="space-y-3">
        {d.categories.map((c) => (
          <section key={c.no} className="card">
            <div className="px-5 py-3 flex items-center gap-3 border-b border-slate-100">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${c.files.length ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {d.system === 'test' ? '✓' : c.no}
              </span>
              <h2 className="font-semibold flex-1">{c.name}</h2>
              {c.files.length
                ? <span className="text-xs text-slate-500">{c.files.length} ไฟล์</span>
                : <span className="chip bg-rose-50 text-rose-700">ยังไม่มีไฟล์</span>}
            </div>
            {c.files.length > 0 && (
              <ul className="divide-y divide-slate-50">
                {c.files.map((f) => (
                  <li key={f.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <Icon name="file" size={18} className="text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <a href={safeUrl(f.fileUrl)} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-800 hover:underline break-all">{f.fileName}</a>
                      <div className="text-xs text-slate-500">{fmtDateTime(f.uploadedAt)} · {f.uploader}{f.sizeKb ? ` · ${formatBytes(f.sizeKb * 1024)}` : ''}</div>
                    </div>
                    {isAdmin && (
                      <button type="button" onClick={() => setPending({ kind: 'file', id: f.id, name: f.fileName })}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label={`ลบ ${f.fileName}`}>
                        <Icon name="trash" size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <Modal open={renaming} onClose={() => setRenaming(false)} title="แก้ไขชื่อชิ้นงาน">
        <form onSubmit={rename} className="space-y-4">
          <div>
            <label className="label" htmlFor="nn">ชื่อชิ้นงานของ {d.partCode}</label>
            <input id="nn" className="input" autoFocus maxLength={200} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-ghost flex-1" onClick={() => setRenaming(false)}>ยกเลิก</button>
            <button className="btn-primary flex-1" disabled={busy || !newName.trim()}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!pending} busy={busy} onClose={() => setPending(null)} onConfirm={doDelete} confirmLabel="ลบ"
        message={pending?.kind === 'file'
          ? `ลบไฟล์ “${pending.name}”? ไฟล์ใน Google Drive จะถูกย้ายไปถังขยะ (กู้คืนได้ภายใน 30 วัน)`
          : `ลบชิ้นงาน ${d.partCode} ทั้งหมด ${total} ไฟล์? ไฟล์ใน Google Drive จะถูกย้ายไปถังขยะ (กู้คืนได้ภายใน 30 วัน)`} />
    </div>
  );
}
