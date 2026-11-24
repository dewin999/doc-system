'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// รีเฟรชข้อมูลบนหน้าจอทุก 60 วินาที เฉพาะตอนผู้ใช้ยังใช้งานอยู่
// (แท็บถูกซ่อน หรือไม่มีการคลิก/พิมพ์/เลื่อนเกิน 10 นาที = หยุด เพื่อให้ session หมดอายุตามการใช้งานจริง)
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    let paused = false;
    const IDLE = 10 * 60 * 1000;
    const tick = () => {
      if (document.hidden || Date.now() - last > IDLE) { paused = true; return; }
      paused = false;
      router.refresh();
    };
    const active = () => {
      last = Date.now();
      if (paused && !document.hidden) tick();
    };
    const evs = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    evs.forEach((e) => document.addEventListener(e, active, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', active);
    const id = setInterval(tick, seconds * 1000);
    return () => {
      clearInterval(id);
      evs.forEach((e) => document.removeEventListener(e, active, { capture: true }));
      document.removeEventListener('visibilitychange', active);
    };
  }, [router, seconds]);
  return null;
}
