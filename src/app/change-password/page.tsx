import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const s = await getSession();
  if (!s) redirect('/login');
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-bold mb-1">เปลี่ยนรหัสผ่าน</h1>
        <p className="text-sm text-slate-500 mb-5">
          {s.mustChange
            ? 'บัญชีนี้ใช้รหัสผ่านชั่วคราวหรือรหัสเริ่มต้น กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน'
            : `บัญชี ${s.username} — เครื่องอื่นที่ล็อกอินอยู่จะถูกออกจากระบบ`}
        </p>
        <ChangePasswordForm forced={s.mustChange} username={s.username} />
      </div>
    </main>
  );
}
