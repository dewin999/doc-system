"""แปลงข้อมูลจากสเปรดชีตระบบเดิม (ไฟล์ .xlsx ที่ดาวน์โหลดจาก Google Sheets) เป็นคำสั่ง SQL
สำหรับนำเข้า Supabase

วิธีใช้:
    python3 scripts/import_xlsx.py DocumentIndex.xlsx out/seed.sql

ไฟล์ผลลัพธ์มีค่า hash รหัสผ่านของผู้ใช้ — ห้าม commit ขึ้น Git (โฟลเดอร์ out/ อยู่ใน .gitignore แล้ว)
รันซ้ำได้: ลบข้อมูลเดิมในตาราง documents / audit_log ที่มาจากการนำเข้าก่อน แล้วใส่ใหม่
ผู้ใช้ที่มีชื่อซ้ำอยู่แล้วจะไม่ถูกเขียนทับ
"""
import re
import sys
from datetime import datetime

import openpyxl

TZ = '+07:00'  # เวลาในชีตเดิมเป็นเวลาไทย
TEST_CATEGORY = 'ใบบันทึกผลการทดสอบ'
CATEGORIES = {
    1: 'ใบรับรองความต้องการ', 2: 'Sketch Design', 3: '3D Drawing', 4: '2D Drawing',
    5: 'ใบบันทึกผลการตรวจสอบเบื้องต้น', 6: 'ใบขอทดสอบแม่พิมพ์',
    7: 'ใบบันทึกผลตรวจสอบและรับรองผลิตภัณฑ์', 8: 'ใบบันทึกผลการทดสอบ', 9: 'ใบมาตรฐานสินค้าและผลิตภัณฑ์',
}


def q(v):
    """ค่าข้อความ → SQL literal"""
    if v is None:
        return "''"
    return "'" + str(v).replace("'", "''") + "'"


def ts(v):
    if v is None or str(v).strip() == '':
        return 'now()'
    if isinstance(v, datetime):
        return q(v.strftime('%Y-%m-%d %H:%M:%S') + TZ) + '::timestamptz'
    s = str(v).strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$', s):
        return q(s + TZ) + '::timestamptz'
    return 'now()'


def num(v, default=0):
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return default


def text(v):
    return '' if v is None else str(v).strip()


def rows_of(ws):
    out = []
    for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if r is None or all(c is None or str(c).strip() == '' for c in r):
            continue
        out.append((i, list(r) + [None] * 13))
    return out


def main(src, dst):
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    lines = ['begin;',
             "delete from public.documents where upload_id is null and legacy_row is not null;",
             "delete from public.audit_log where detail like '%[นำเข้าจากระบบเดิม]%';"]
    counts = {}

    for sheet, system in (('เอกสารชิ้นงาน', 'main'), ('ใบบันทึกผลการทดสอบ', 'test')):
        if sheet not in wb.sheetnames:
            continue
        n = 0
        for row_no, r in rows_of(wb[sheet]):
            code = text(r[0])
            if not code:
                continue
            if system == 'test':
                cat_no, cat_name = 1, TEST_CATEGORY  # ระบบใบทดสอบมีหมวดเดียว
            else:
                cat_no = num(r[2], 0)
                if cat_no not in CATEGORIES:
                    print(f'ข้าม {sheet} แถว {row_no}: หมวดหมู่ไม่ถูกต้อง ({r[2]!r})', file=sys.stderr)
                    continue
                cat_name = CATEGORIES[cat_no]
            status = 'deleted' if text(r[11]) == 'ลบแล้ว' else 'active'
            lines.append(
                'insert into public.documents (system, part_code, part_name, category_no, category_name, file_name, '
                'file_url, file_id, mime_type, size_kb, uploader, uploaded_at, status, note, legacy_row) values ('
                + ', '.join([q(system), q(code[:100]), q(text(r[1])), str(cat_no), q(cat_name), q(text(r[4]) or 'untitled'),
                             q(text(r[5])), q(text(r[6])), q(text(r[7])), str(num(r[8])), q(text(r[9])),
                             ts(r[10]), q(status), q(text(r[12])), str(row_no)]) + ');')
            n += 1
        counts[sheet] = n

    if 'Users' in wb.sheetnames:
        n = 0
        for _, r in rows_of(wb['Users']):
            u = text(r[0])
            if not re.match(r'^[A-Za-z0-9._-]{1,30}$', u):
                print(f'ข้ามผู้ใช้ {u!r}: ชื่อผู้ใช้มีอักขระที่ไม่รองรับ', file=sys.stderr)
                continue
            role = 'admin' if text(r[2]).lower() == 'admin' else 'user'
            must = str(r[4]).strip().upper() == 'TRUE' if r[4] is not None else False
            lines.append(
                'insert into public.users (username, password_hash, role, name, must_change) select '
                + ', '.join([q(u), q(text(r[1])), q(role), q(text(r[3])), 'true' if must else 'false'])
                + f" where not exists (select 1 from public.users where lower(username) = lower({q(u)}));")
            n += 1
        counts['Users'] = n

    if 'AuditLog' in wb.sheetnames:
        n = 0
        for _, r in rows_of(wb['AuditLog']):
            lines.append(
                'insert into public.audit_log (at, username, action, part_code, system, detail) values ('
                + ', '.join([ts(r[0]), q(text(r[1]) or '-'), q(text(r[2]) or '-'), q(text(r[3]) or '-'),
                             q(text(r[4]) or '-'), q((text(r[5]) + ' [นำเข้าจากระบบเดิม]').strip())]) + ');')
            n += 1
        counts['AuditLog'] = n

    lines.append('commit;')
    with open(dst, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('เขียน', dst, counts)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
