import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.mustChange ? '/change-password' : '/');
  const { expired } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-800 text-white flex items-center justify-center text-2xl font-bold mb-3">D</div>
          <h1 className="text-xl font-bold text-slate-800">ระบบจัดการเอกสารชิ้นงาน</h1>
          <p className="text-sm text-slate-500 mt-1">กรุณาเข้าสู่ระบบเพื่อใช้งาน</p>
        </div>
        {expired && (
          <p className="mb-4 text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-3 py-2">
            เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
