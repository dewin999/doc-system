import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-10 text-center">
        <p className="text-slate-600">ไม่พบหน้าที่ต้องการ</p>
        <Link href="/" className="btn-primary mt-4">กลับหน้าแรก</Link>
      </div>
    </main>
  );
}
