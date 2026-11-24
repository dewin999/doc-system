import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

// error ที่ตั้งใจส่งข้อความกลับให้ผู้ใช้ (ข้อความอื่นจะถูกซ่อนเป็น "เกิดข้อผิดพลาด")
export class ApiError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

// กัน CSRF: คำขอที่เปลี่ยนข้อมูลต้องมาจากโดเมนเดียวกับแอปเท่านั้น
function checkSameOrigin(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) throw new ApiError(403, 'คำขอไม่ถูกต้อง');
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* ignore */ }
  if (originHost !== host) throw new ApiError(403, 'คำขอไม่ถูกต้อง');
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<unknown>;

export function route<C = unknown>(fn: Handler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      checkSameOrigin(req);
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { success: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ success: false, message: e.message, ...e.extra }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, 'ข้อมูลมีขนาดใหญ่เกินไป');
  try {
    const v = JSON.parse(text || '{}');
    if (!v || typeof v !== 'object') throw new Error();
    return v as T;
  } catch {
    throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง');
  }
}

export function str(v: unknown, max = 500) {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}
