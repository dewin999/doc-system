'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon, { type IconName } from './Icon';
import { api } from '@/lib/client';

const MENU: { href: string; label: string; icon: IconName; admin?: boolean }[] = [
  { href: '/', label: 'แดชบอร์ด', icon: 'dashboard' },
  { href: '/upload', label: 'อัปโหลดเอกสาร', icon: 'upload' },
  { href: '/search', label: 'ค้นหา / แก้ไข', icon: 'search' },
  { href: '/list', label: 'รายการทั้งหมด', icon: 'list' },
  { href: '/tests', label: 'ใบบันทึกผลการทดสอบ', icon: 'test' },
  { href: '/users', label: 'ผู้ใช้งาน', icon: 'users', admin: true }
];

function isActive(path: string, href: string) {
  if (href === '/') return path === '/';
  if (href === '/search') return path === '/search' || path.startsWith('/parts/');
  return path === href || path.startsWith(href + '/');
}

export default function Sidebar({ user }: { user: { name: string; role: string } }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  async function logout() {
    await api('/api/auth/logout', {});
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-emerald-800 text-white flex flex-col px-3 py-5 overflow-y-auto
          transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-3 pb-5 flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-[17px] leading-snug">ระบบจัดการเอกสารชิ้นงาน</div>
            <div className="text-xs text-emerald-200 mt-0.5">เอกสาร 9 ขั้นตอน + ใบทดสอบ</div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-emerald-700" aria-label="ปิดเมนู">
            <Icon name="close" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="เมนูหลัก">
          {MENU.filter((m) => !m.admin || user.role === 'admin').map((m) => {
            const active = isActive(path, m.href);
            return (
              <Link key={m.href} href={m.href} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition
                  ${active ? 'bg-emerald-950/60 text-white shadow-[inset_3px_0_0_#6ee7b7] font-medium' : 'text-emerald-50 hover:bg-emerald-700'}`}>
                <Icon name={m.icon} />
                <span>{m.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3 mt-auto pt-4 px-2 border-t border-emerald-700">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${user.role === 'admin' ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-600'}`}>
              {user.role}
            </span>
          </div>
          <div className="flex gap-2">
            <Link href="/change-password" className="flex-1 text-center text-xs py-2 rounded-lg bg-emerald-900 hover:bg-emerald-700 border border-emerald-700 transition">
              เปลี่ยนรหัสผ่าน
            </Link>
            <button type="button" onClick={logout} className="flex-1 text-xs py-2 rounded-lg border border-emerald-700 hover:bg-red-700 transition">
              ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-slate-900/40 z-30 md:hidden" onClick={() => setOpen(false)} />}

      <header className="md:hidden sticky top-0 z-20 bg-emerald-800 text-white flex items-center gap-3 px-4 py-3 shadow">
        <button type="button" onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-emerald-700" aria-label="เปิดเมนู">
          <Icon name="menu" size={22} />
        </button>
        <span className="font-bold">ระบบจัดการเอกสารชิ้นงาน</span>
      </header>
    </>
  );
}
