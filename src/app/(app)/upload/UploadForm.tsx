'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { api, randomId, toast } from '@/lib/client';
import { CATEGORIES, MAX_FILE_BYTES, partHref, type SystemType } from '@/lib/constants';
import { formatBytes } from '@/lib/format';

type Lookup = { exists: boolean; partCode: string | null; partName: string; filled: { no: number; name: string }[]; files: number; other: { system: SystemType; partName: string } | null };
type Item = { key: string; file: File; status: 'wait' | 'up' | 'ok' | 'err'; pct: number; msg?: string; uploadId: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ส่งชิ้นไฟล์ 1 ชิ้น ลองซ้ำ 3 ครั้งถ้าเน็ตสะดุด
async function sendChunk(ticket: string, offset: number, blob: Blob) {
  let last = '';
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`/api/upload/chunk?offset=${offset}`, { method: 'POST', headers: { 'x-upload-ticket': ticket, 'Content-Type': 'application/octet-stream' }, body: blob });
      const j = await res.json();
      if (j.sessionExpired) { window.location.href = '/login?expired=1'; throw new Error('expired'); }
      if (j.success) return j as { next?: number; done?: boolean; fileId?: string };
      last = j.message || `ผิดพลาด (${res.status})`;
      if (res.status < 500) throw new Error(last);
    } catch (e) {
      last = (e as Error).message || 'เชื่อมต่อไม่สำเร็จ';
      if (last === 'expired') throw e;
    }
    await sleep(1000 * (i + 1));
  }
  throw new Error(last);
}

export default function UploadForm({ initialSystem, initialCode }: { initialSystem: SystemType; initialCode: string }) {
  const [system, setSystem] = useState<SystemType>(initialSystem);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [cat, setCat] = useState(1);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameTouched = useRef(false);

  // ตรวจรหัสชิ้นงานว่ามีอยู่แล้วหรือไม่ (หน่วง 400ms ระหว่างพิมพ์)
  useEffect(() => {
    const c = code.trim();
    if (!c) { setLookup(null); return; }
    let live = true;
    const t = setTimeout(async () => {
      const r = await api<{ data: Lookup }>(`/api/lookup?system=${system}&code=${encodeURIComponent(c)}`);
      if (!live || !r.success) return;
      setLookup(r.data);
      if (r.data?.exists && !nameTouched.current) setName(r.data.partName || '');
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [code, system]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const add: Item[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) { toast(`ไฟล์ "${f.name}" มีขนาดเกิน 10 MB`, 'error'); continue; }
      if (f.size === 0) { toast(`ไฟล์ "${f.name}" ว่างเปล่า`, 'error'); continue; }
      add.push({ key: randomId(), file: f, status: 'wait', pct: 0, uploadId: randomId() });
    }
    setItems((cur) => [...cur.filter((i) => i.status !== 'ok'), ...add].slice(0, 20));
    if (fileRef.current) fileRef.current.value = '';
  }

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function uploadOne(it: Item) {
    patch(it.key, { status: 'up', pct: 0, msg: undefined });
    const f = it.file;
    const start = await api<{ ticket?: string; chunkSize?: number; done?: boolean }>('/api/upload/start', {
      system, partCode: code.trim(), partName: name.trim(), categoryNo: cat,
      fileName: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, uploadId: it.uploadId
    });
    if (!start.success) throw new Error(start.message || 'เริ่มอัปโหลดไม่สำเร็จ');
    if (start.done) return;
    const ticket = start.ticket!;
    const size = start.chunkSize!;
    let offset = 0;
    let fileId = '';
    while (!fileId) {
      const r = await sendChunk(ticket, offset, f.slice(offset, Math.min(offset + size, f.size)));
      if (r.done && r.fileId) fileId = r.fileId;
      else {
        offset = r.next ?? offset + size;
        patch(it.key, { pct: Math.round((offset / f.size) * 95) });
      }
    }
    const done = await api('/api/upload/complete', { ticket, fileId });
    if (!done.success) throw new Error(done.message || 'บันทึกไม่สำเร็จ');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return toast('กรุณาระบุรหัสชิ้นงาน', 'error');
    const queue = items.filter((i) => i.status === 'wait' || i.status === 'err');
    if (!queue.length) return toast('กรุณาเลือกไฟล์', 'error');
    setBusy(true);
    let ok = 0;
    for (const it of queue) {
      try {
        await uploadOne(it);
        patch(it.key, { status: 'ok', pct: 100 });
        ok++;
      } catch (err) {
        patch(it.key, { status: 'err', msg: (err as Error).message });
      }
    }
    setBusy(false);
    if (ok === queue.length) toast(`อัปโหลดสำเร็จ ${ok} ไฟล์`, 'success');
    else toast(`อัปโหลดสำเร็จ ${ok} จาก ${queue.length} ไฟล์ — กด "อัปโหลด" อีกครั้งเพื่อลองไฟล์ที่ไม่สำเร็จ`, 'warn');
    if (ok) {
      const r = await api<{ data: Lookup }>(`/api/lookup?system=${system}&code=${encodeURIComponent(code.trim())}`);
      if (r.success) setLookup(r.data);
    }
  }

  const filledNos = new Set(lookup?.filled.map((f) => f.no) ?? []);
  const doneCount = items.filter((i) => i.status === 'ok').length;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="card p-5 lg:col-span-2 space-y-5">
        <div>
          <span className="label">ประเภทเอกสาร</span>
          <div className="grid grid-cols-2 gap-2">
            {(['main', 'test'] as const).map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => setSystem(s)}
                className={`px-4 py-3 rounded-xl border text-sm text-left transition ${system === s ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="font-semibold">{s === 'main' ? 'เอกสารทั่วไป (9 หมวด)' : 'ใบบันทึกผลการทดสอบ'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s === 'main' ? 'เลือกหมวดเอกสาร 1–9' : 'เก็บแยกโฟลเดอร์ของใบทดสอบ'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="code">รหัสชิ้นงาน *</label>
            <input id="code" className="input" required maxLength={100} disabled={busy} value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น PART-001" />
          </div>
          <div>
            <label className="label" htmlFor="name">ชื่อชิ้นงาน</label>
            <input id="name" className="input" maxLength={200} disabled={busy} value={name} onChange={(e) => { nameTouched.current = true; setName(e.target.value); }} />
          </div>
        </div>

        {system === 'main' && (
          <div>
            <label className="label" htmlFor="cat">หมวดเอกสาร *</label>
            <select id="cat" className="input" disabled={busy} value={cat} onChange={(e) => setCat(Number(e.target.value))}>
              {CATEGORIES.map((c) => <option key={c.no} value={c.no}>{c.no}. {c.name}{filledNos.has(c.no) ? ' (มีไฟล์แล้ว)' : ''}</option>)}
            </select>
          </div>
        )}

        <div>
          <span className="label">ไฟล์ (เลือกได้หลายไฟล์)</span>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (!busy) addFiles(e.dataTransfer.files); }}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-2xl py-8 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/40 transition">
            <Icon name="upload" size={28} className="text-emerald-700" />
            <span className="text-sm text-slate-600">ลากไฟล์มาวาง หรือ <span className="text-emerald-700 font-medium">คลิกเพื่อเลือก</span></span>
            <span className="text-xs text-slate-400">สูงสุด 10 MB ต่อไฟล์</span>
            <input ref={fileRef} type="file" multiple className="sr-only" disabled={busy} onChange={(e) => addFiles(e.target.files)} />
          </label>
          {items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {items.map((i) => (
                <li key={i.key} className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon name="file" size={16} className="text-slate-400 shrink-0" />
                    <span className="flex-1 truncate">{i.file.name}</span>
                    <span className="text-xs text-slate-500">{formatBytes(i.file.size)}</span>
                    {i.status === 'ok' && <span className="text-emerald-700 text-xs font-semibold">สำเร็จ</span>}
                    {i.status === 'err' && <span className="text-rose-600 text-xs font-semibold">ไม่สำเร็จ</span>}
                    {(i.status === 'wait' || i.status === 'err') && !busy && (
                      <button type="button" className="text-slate-400 hover:text-rose-600" aria-label="เอาออก" onClick={() => setItems((c) => c.filter((x) => x.key !== i.key))}>
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                  {i.status === 'up' && <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-emerald-600 transition-all" style={{ width: Math.max(i.pct, 3) + '%' }} /></div>}
                  {i.msg && <div className="text-xs text-rose-600 mt-1">{i.msg}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          {doneCount > 0 && code.trim() && <Link href={partHref(system, lookup?.partCode || code.trim())} className="btn-ghost">ดูชิ้นงาน</Link>}
          <button className="btn-primary px-6" disabled={busy}>{busy ? 'กำลังอัปโหลด...' : 'อัปโหลด'}</button>
        </div>
      </div>

      <aside className="card p-5 h-fit space-y-3 text-sm">
        <h2 className="font-semibold">ข้อมูลชิ้นงาน</h2>
        {!code.trim() && <p className="text-slate-400">พิมพ์รหัสชิ้นงานเพื่อดูเอกสารที่มีอยู่แล้ว</p>}
        {code.trim() && lookup && !lookup.exists && <p className="text-slate-600">ชิ้นงานใหม่ — ยังไม่มีเอกสารใน{system === 'main' ? 'เอกสารทั่วไป' : 'ใบทดสอบ'}</p>}
        {lookup?.exists && (
          <>
            <p><Link href={partHref(system, lookup.partCode!)} className="font-medium text-emerald-800 hover:underline">{lookup.partCode}</Link> มีอยู่แล้ว {lookup.files} ไฟล์</p>
            {system === 'main' && (
              <ul className="space-y-1">
                {CATEGORIES.map((c) => (
                  <li key={c.no} className={`flex gap-2 ${filledNos.has(c.no) ? 'text-emerald-700' : 'text-slate-400'}`}>
                    <span>{filledNos.has(c.no) ? '✓' : '○'}</span><span>{c.no}. {c.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {lookup?.other && (
          <p className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
            รหัสนี้มีใน{lookup.other.system === 'test' ? 'ใบบันทึกผลการทดสอบ' : 'เอกสารทั่วไป'}ด้วย{lookup.other.partName ? ` (${lookup.other.partName})` : ''} — ตรวจว่าเลือกประเภทถูก
          </p>
        )}
      </aside>
    </form>
  );
}
