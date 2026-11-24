'use client';

import { useEffect, useState } from 'react';

type T = { message: string; type: string; id: number };

export default function Toaster() {
  const [t, setT] = useState<T | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { message: string; type: string };
      setT({ ...d, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), d.type === 'error' ? 9000 : 3500);
    };
    window.addEventListener('app-toast', on);
    return () => { window.removeEventListener('app-toast', on); clearTimeout(timer); };
  }, []);
  if (!t) return null;
  const color = t.type === 'error' ? 'bg-rose-600' : t.type === 'warn' ? 'bg-amber-500' : 'bg-emerald-700';
  return (
    <div role="status" aria-live="polite" className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] px-4 w-full max-w-lg">
      <div className={`px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${color}`} onClick={() => setT(null)}>
        {t.message}
      </div>
    </div>
  );
}
