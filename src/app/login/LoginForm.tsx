'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await api<{ mustChange?: boolean }>('/api/auth/login', { username: username.trim(), password });
    if (res.success) {
      // โหลดหน้าใหม่ทั้งหน้า ให้ข้อมูลทุกส่วนมาจาก session ใหม่
      window.location.href = res.mustChange ? '/change-password' : '/';
      return;
    }
    setBusy(false);
    setPassword('');
    setError(res.message || 'เข้าสู่ระบบไม่สำเร็จ');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="u">ชื่อผู้ใช้</label>
        <input id="u" className="input" autoComplete="username" autoFocus required maxLength={100}
          value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="p">รหัสผ่าน</label>
        <input id="p" type="password" className="input" autoComplete="current-password" required maxLength={200}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</button>
    </form>
  );
}
