import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.mustChange) redirect('/change-password');
  return (
    <div className="min-h-screen">
      <Sidebar user={{ name: s.name, role: s.role }} />
      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
