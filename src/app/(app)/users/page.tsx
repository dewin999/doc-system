import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const me = await getSession();
  if (me?.role !== 'admin') redirect('/');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">ผู้ใช้งาน</h1>
        <p className="text-sm text-slate-500 mt-1">เพิ่ม แก้ไขสิทธิ์ รีเซ็ตรหัสผ่าน หรือลบผู้ใช้ (เฉพาะ Admin)</p>
      </div>
      <UsersClient me={me.username} />
    </div>
  );
}
