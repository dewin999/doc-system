import { route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 30;

// พื้นที่ Google Drive — ดึงจาก Drive ช้า (หลายวินาที) จึงจำผลไว้ 15 นาทีต่อ instance
let cached: { at: number; data: { limit: number; used: number } } | null = null;

export const GET = route(async () => {
  await requireUser();
  if (!cached || Date.now() - cached.at > 15 * 60 * 1000) {
    cached = { at: Date.now(), data: await getStorage() };
  }
  const { limit, used } = cached.data;
  return { success: true, limit, used, remaining: limit > 0 ? Math.max(limit - used, 0) : null };
});
