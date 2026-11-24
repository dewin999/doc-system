'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import Modal, { ConfirmModal } from '@/components/Modal';
import { api, randomPassword, toast } from '@/lib/client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

type U = { username: string; name: string; role: 'admin' | 'user'; mustChange: boolean };
type Mode = { kind: 'add' } | { kind: 'edit'; u: U } | { kind: 'reset'; u: U } | null;

export default function UsersClient({ me }: { me: string }) {
  const [users, setUsers] = useState<U[] | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [del, setDel] = useState<U | null>(null);
  const [f, setF] = useState({ username: '', name: '', role: 'user', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isMe = (u: U) => u.username.toLowerCase() === me.toLowerCase();

  const load = useCallback(async () => {
    const r = await api<{ data: U[] }>('/api/users');
    if (r.success) setUsers(r.data);
    else toast(r.message || 'โหลดรายชื่อไม่สำเร็จ', 'error');
  }, []);
  useEffect(() => { load(); }, [load]);

  function open(m: Mode) {
    setErr('');
    if (m?.kind === 'add') setF({ username: '', name: '', role: 'user', password: randomPassword() });
    if (m?.kind === 'edit') setF({ username: m.u.username, name: m.u.name, role: m.u.role, password: '' });
    if (m?.kind === 'reset') setF({ username: m.u.username, name: m.u.name, role: m.u.role, password: randomPassword() });
    setMode(m);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (mode?.kind !== 'edit' && f.password.length < MIN_PASSWORD_LENGTH) return setErr(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
    setBusy(true);
    const r = mode?.kind === 'add' ? await api('/api/users', f)
      : mode?.kind === 'edit' ? await api('/api/users/update', { username: f.username, name: f.name, role: f.role })
      : await api('/api/users/reset', { username: f.username, password: f.password });
    setBusy(false);
    if (!r.success) return setErr(r.message || 'ไม่สำเร็จ');
    toast(r.message || 'บันทึกแล้ว', 'success');
    setMode(null);
    load();
  }

  async function doDelete() {
    if (!del) return;
    setBusy(true);
    const r = await api('/api/users/delete', { username: del.username });
    setBusy(false);
    setDel(null);
    toast(r.message || (r.success ? 'ลบแล้ว' : 'ไม่สำเร็จ'), r.success ? 'success' : 'error');
    if (r.success) load();
  }

  return (
    <div className="card">
      <div className="p-4 flex justify-end border-b border-slate-100">
        <button type="button" className="btn-primary" onClick={() => open({ kind: 'add' })}>+ เพิ่มผู้ใช้</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">ชื่อผู้ใช้</th>
              <th className="px-4 py-3 font-medium">ชื่อที่แสดง</th>
              <th className="px-4 py-3 font-medium">สิทธิ์</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!users && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">กำลังโหลด...</td></tr>}
            {users?.map((u) => (
              <tr key={u.username}>
                <td className="px-4 py-3 font-medium">{u.username}{isMe(u) && <span className="text-xs text-slate-400 ml-1">(คุณ)</span>}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3"><span className={`chip ${u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                <td className="px-4 py-3 text-xs">{u.mustChange ? <span className="text-amber-700">รอเปลี่ยนรหัสผ่าน</span> : <span className="text-emerald-700">ปกติ</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button type="button" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="แก้ไข" onClick={() => open({ kind: 'edit', u })}><Icon name="edit" size={18} /></button>
                    {!isMe(u) && <>
                      <button type="button" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="รีเซ็ตรหัสผ่าน" onClick={() => open({ kind: 'reset', u })}><Icon name="key" size={18} /></button>
                      <button type="button" className="p-2 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600" title="ลบ" onClick={() => setDel(u)}><Icon name="trash" size={18} /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!mode} onClose={() => setMode(null)} wide
        title={mode?.kind === 'add' ? 'เพิ่มผู้ใช้' : mode?.kind === 'edit' ? `แก้ไขผู้ใช้ ${f.username}` : `รีเซ็ตรหัสผ่าน ${f.username}`}>
        <form onSubmit={submit} className="space-y-4">
          {mode?.kind === 'add' && (
            <div>
              <label className="label" htmlFor="uu">ชื่อผู้ใช้ (a-z, 0-9, . _ -)</label>
              <input id="uu" className="input" required maxLength={30} pattern="[A-Za-z0-9._\-]{3,30}" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.trim() })} />
            </div>
          )}
          {mode?.kind !== 'reset' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="un">ชื่อที่แสดง</label>
                <input id="un" className="input" maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="ur">สิทธิ์</label>
                <select id="ur" className="input" value={f.role} disabled={mode?.kind === 'edit' && isMe(mode.u)} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          )}
          {mode?.kind !== 'edit' && (
            <div>
              <label className="label" htmlFor="up">รหัสผ่านชั่วคราว</label>
              <div className="flex gap-2">
                <input id="up" className="input font-mono" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
                <button type="button" className="btn-ghost shrink-0" onClick={() => setF({ ...f, password: randomPassword() })}>สุ่มใหม่</button>
              </div>
              <p className="text-xs text-slate-500 mt-1">จดรหัสนี้ไว้แจ้งผู้ใช้ ระบบจะให้ตั้งรหัสใหม่ตอนเข้าสู่ระบบ</p>
            </div>
          )}
          {err && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{err}</p>}
          <div className="flex gap-3">
            <button type="button" className="btn-ghost flex-1" onClick={() => setMode(null)}>ยกเลิก</button>
            <button className="btn-primary flex-1" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!del} busy={busy} onClose={() => setDel(null)} onConfirm={doDelete} confirmLabel="ลบผู้ใช้"
        message={`ลบผู้ใช้ “${del?.username}”? ผู้ใช้นี้จะถูกออกจากระบบทันทีและเข้าสู่ระบบไม่ได้อีก`} />
    </div>
  );
}
