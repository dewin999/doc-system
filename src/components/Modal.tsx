'use client';

import { useEffect, type ReactNode } from 'react';

export default function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white rounded-2xl shadow-2xl w-full p-6 ${wide ? 'max-w-lg' : 'max-w-sm'}`}>
        <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, message, confirmLabel = 'ยืนยัน', danger = true, busy = false, onConfirm, onClose }: {
  open: boolean; message: string; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="ยืนยันการทำรายการ">
      <p className="text-sm text-slate-700 mb-6">{message}</p>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-medium text-sm">ยกเลิก</button>
        <button type="button" disabled={busy} onClick={onConfirm}
          className={`flex-1 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-800 hover:bg-emerald-900'}`}>
          {busy ? 'กำลังดำเนินการ...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
