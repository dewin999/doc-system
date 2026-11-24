'use client';

import { useState } from 'react';
import { api, toast } from '@/lib/client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

export default function ChangePasswordForm({ forced, username }: { forced: boolean; username: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
    if (next !== confirm) return setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
    if (next.toLowerCase() === username.toLowerCase()) return setError('รหัสผ่านต้องไม่เหมือนชื่อผู้ใช้');
    setBusy(true);
    const res = await api('/api/auth/change-password', { current, next });
    setBusy(false);
    if (!res.success) return setError(res.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    toast(res.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
    window.location.href = '/';
  }

  async function logout() {
    await api('/api/auth/logout', {});
    window.location.href = '/login';
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="c">รหัสผ่านปัจจุบัน</label>
        <input id="c" type="password" className="input" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="n">รหัสผ่านใหม่ (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัว)</label>
        <input id="n" type="password" className="input" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="cf">ยืนยันรหัสผ่านใหม่</label>
        <input id="cf" type="password" className="input" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        {forced
          ? <button type="button" onClick={logout} className="btn-ghost flex-1">ออกจากระบบ</button>
          : <a href="/" className="btn-ghost flex-1">ยกเลิก</a>}
        <button className="btn-primary flex-1" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      </div>
    </form>
  );
}
