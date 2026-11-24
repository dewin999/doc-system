// จัดรูปแบบวันที่/ขนาดไฟล์ — ใช้เวลาไทยเสมอ ไม่ขึ้นกับเขตเวลาของเครื่องเซิร์ฟเวอร์
const TZ = 'Asia/Bangkok';
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function parts(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { y: g('year'), m: g('month'), d: g('day'), hh: g('hour') === '24' ? '00' : g('hour'), mm: g('minute') };
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const p = parts(d);
  return `${p.y}-${p.m}-${p.d} ${p.hh}:${p.mm}`;
}

// "13:12" (วันนี้) / "เมื่อวาน 13:12" / "7 ต.ค."
export function fmtWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const p = parts(d);
  const t = parts(now);
  const y = parts(new Date(now.getTime() - 86400000));
  const day = `${p.y}-${p.m}-${p.d}`;
  if (day === `${t.y}-${t.m}-${t.d}`) return `${p.hh}:${p.mm}`;
  if (day === `${y.y}-${y.m}-${y.d}`) return `เมื่อวาน ${p.hh}:${p.mm}`;
  return `${Number(p.d)} ${MONTHS[Number(p.m) - 1]}${p.y !== t.y ? ' ' + (Number(p.y) + 543) : ''}`;
}

export function formatBytes(bytes: number) {
  bytes = Number(bytes) || 0;
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

// อนุญาตเฉพาะลิงก์ https:// (กันค่าแปลกๆ อย่าง javascript:)
export function safeUrl(u: string) {
  return /^https:\/\//i.test(String(u || '').trim()) ? u : '#';
}
