'use client';

export type ApiResult<T = Record<string, unknown>> = { success: boolean; message?: string } & T;

// เรียก API ของแอป — ถ้า session หมดอายุจะพาไปหน้า login, ถ้าต้องเปลี่ยนรหัสผ่านจะพาไปหน้าเปลี่ยนรหัส
export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    });
  } catch {
    return { success: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต' } as ApiResult<T>;
  }
  let data: ApiResult<T>;
  try {
    data = await res.json();
  } catch {
    return { success: false, message: `เกิดข้อผิดพลาด (${res.status})` } as ApiResult<T>;
  }
  const d = data as { sessionExpired?: boolean; passwordChangeRequired?: boolean };
  if (d.sessionExpired) window.location.href = '/login?expired=1';
  else if (d.passwordChangeRequired) window.location.href = '/change-password';
  return data;
}

export type ToastType = 'success' | 'error' | 'warn' | 'info';
export function toast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

export function randomId() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return 'u' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}
