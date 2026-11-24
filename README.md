# ระบบจัดการเอกสารชิ้นงาน (Vercel + Supabase)

ย้ายจาก Google Apps Script มาเป็น Next.js บน Vercel + ฐานข้อมูล Postgres บน Supabase
ไฟล์เอกสารยังเก็บใน **Google Drive เดิม** ผ่าน Apps Script ตัวเล็ก ("Drive Gateway")

```
เบราว์เซอร์ ──► Vercel (Next.js) ──► Supabase Postgres   (ข้อมูลเอกสาร / ผู้ใช้ / log)
                      │
                      └──► Apps Script Drive Gateway ──► Google Drive (ไฟล์จริง)
```

## ติดตั้งครั้งแรก (ทำครั้งเดียว)

### 1. Supabase
1. สร้างโปรเจกต์ใหม่ (Region: Singapore) จดรหัสผ่านฐานข้อมูลไว้
2. เมนู **SQL Editor** → วางไฟล์ `supabase/migrations/0001_init.sql` → Run
3. นำข้อมูลเดิมเข้า: บนเครื่องที่มีไฟล์ `DocumentIndex.xlsx`
   ```bash
   pip install openpyxl
   python3 scripts/import_xlsx.py DocumentIndex.xlsx out/seed.sql
   ```
   แล้ววาง `out/seed.sql` ใน SQL Editor → Run
   > `out/seed.sql` มี hash รหัสผ่านผู้ใช้ — **ห้าม commit ขึ้น Git** (อยู่ใน .gitignore แล้ว)
4. **Project Settings → Database → Connection string → Transaction pooler** (พอร์ต 6543)
   คัดลอกไว้เป็น `DATABASE_URL` (แทน `[YOUR-PASSWORD]` ด้วยรหัสผ่านฐานข้อมูล)

### 2. Drive Gateway (Apps Script) — ใช้บัญชี Google เจ้าของ Drive เดิม
1. ไปที่ script.google.com → New project → ตั้งชื่อ `Drive Gateway`
2. วางโค้ด `apps-script/DriveGateway.gs` แทนโค้ดเดิม
3. Project Settings → ติ๊ก "Show appsscript.json" → วางเนื้อหา `apps-script/appsscript.json`
4. เลือกฟังก์ชัน `generateSecret` → Run → อนุญาตสิทธิ์ → ดู **Execution log** คัดลอก secret ไว้เป็น `DRIVE_GATEWAY_SECRET`
5. Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → คัดลอก URL (ลงท้าย `/exec`) เป็น `DRIVE_GATEWAY_URL`

Gateway ใช้โฟลเดอร์ `ระบบจัดเก็บเอกสารชิ้นงาน` เดิม ไฟล์เก่าอยู่ที่เดิม ไม่ต้องย้าย

### 3. Vercel
1. Import repo นี้จาก GitHub (Framework: Next.js)
2. Environment Variables (Production + Preview):

| ชื่อ | ค่า |
|---|---|
| `DATABASE_URL` | Transaction pooler URL จากข้อ 1.4 |
| `SESSION_SECRET` | สุ่มยาว ≥ 32 ตัว เช่น `openssl rand -base64 48` |
| `DRIVE_GATEWAY_URL` | URL `/exec` จากข้อ 2.5 |
| `DRIVE_GATEWAY_SECRET` | secret จากข้อ 2.4 |

3. Deploy

## หลังย้ายระบบ
- ผู้ใช้ login ด้วยรหัสเดิมได้ ระบบแปลง hash เป็นแบบใหม่ให้อัตโนมัติตอน login
- บัญชีที่ยังใช้รหัสเริ่มต้น (admin123 / user123) จะถูกบังคับให้ตั้งรหัสใหม่
- ถ้าผู้ใช้คนไหน login ไม่ได้ ให้ Admin ใช้ "รีเซ็ตรหัสผ่าน" ในหน้าผู้ใช้งาน
- ปิดการใช้งานระบบ Apps Script เดิม (Deploy → Manage deployments → Archive) หลังตรวจว่าระบบใหม่ใช้ได้ เพื่อไม่ให้มีคนอัปโหลดเข้าระบบเก่า

## พัฒนาบนเครื่อง
```bash
npm install
cp .env.example .env.local   # ใส่ค่าให้ครบ (Postgres ในเครื่องใช้ DATABASE_SSL=disable)
npm run dev
```

## ความปลอดภัย
- ฐานข้อมูลเปิด RLS ทุกตาราง ไม่มี policy → เข้าถึงผ่าน anon key ไม่ได้ อ่าน/เขียนได้จากเซิร์ฟเวอร์ (Vercel) เท่านั้น
- รหัสผ่าน: HMAC-SHA256 60,000 รอบ + salt, ล็อก 15 นาทีเมื่อผิด 5 ครั้ง
- Session: คุกกี้ httpOnly, หมดอายุเมื่อไม่ใช้งาน 6 ชม. / สูงสุด 24 ชม.
- อัปโหลด: แบ่งไฟล์เป็นชิ้น 3 MB ผ่านเซิร์ฟเวอร์ (URL อัปโหลดของ Drive ไม่ถึงเบราว์เซอร์) และตรวจกับ Drive ก่อนบันทึก
