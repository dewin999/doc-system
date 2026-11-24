-- ระบบจัดเก็บเอกสารชิ้นงาน — โครงสร้างฐานข้อมูล (Supabase / PostgreSQL)
-- ทุกตารางเปิด RLS และไม่มี policy ให้ anon/authenticated เลย:
-- แอปเข้าถึงข้อมูลผ่าน service role จากฝั่งเซิร์ฟเวอร์ (Vercel) เท่านั้น
-- ห้ามใช้ anon key อ่าน/เขียนตารางเหล่านี้จากเบราว์เซอร์

-- ---------- ผู้ใช้ ----------
create table if not exists public.users (
  id            bigint generated always as identity primary key,
  username      text not null check (username ~ '^[A-Za-z0-9._-]{1,30}$'),
  password_hash text not null,
  role          text not null default 'user' check (role in ('admin', 'user')),
  name          text not null default '',
  must_change   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists users_username_lower_idx on public.users (lower(username));

-- ---------- session (เก็บเฉพาะ sha256 ของ token) ----------
create table if not exists public.sessions (
  token_hash  text primary key,
  user_id     bigint not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  renewed_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

-- ---------- จำกัดการ login ผิด ----------
create table if not exists public.login_failures (
  username_key text primary key,       -- sha256(lower(username))
  fail_count   int not null default 0,
  expires_at   timestamptz not null
);

-- ---------- เอกสาร (ทั้งระบบทั่วไปและใบทดสอบ) ----------
create table if not exists public.documents (
  id            bigint generated always as identity primary key,
  system        text not null check (system in ('main', 'test')),
  part_code     text not null check (length(part_code) between 1 and 100),
  part_name     text not null default '',
  category_no   int  not null check (category_no between 1 and 9),
  category_name text not null,
  file_name     text not null,
  file_url      text not null default '',
  file_id       text not null default '',
  mime_type     text not null default '',
  size_kb       int  not null default 0,
  uploader      text not null default '',
  uploaded_at   timestamptz not null default now(),
  status        text not null default 'active' check (status in ('active', 'deleted')),
  note          text not null default '',
  upload_id     text unique,             -- กันไฟล์ซ้ำเมื่อส่งซ้ำ (null = ข้อมูลนำเข้าจากระบบเดิม)
  legacy_row    int                      -- เลขแถวในชีตเดิม (อ้างอิงตอนย้ายข้อมูล)
);
create index if not exists documents_part_idx on public.documents (system, lower(part_code)) where status = 'active';
create index if not exists documents_recent_idx on public.documents (uploaded_at desc) where status = 'active';

-- ---------- ประวัติการใช้งาน ----------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  username   text not null default '-',
  action     text not null default '-',
  part_code  text not null default '-',
  system     text not null default '-',
  detail     text not null default ''
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

alter table public.users          enable row level security;
alter table public.sessions       enable row level security;
alter table public.login_failures enable row level security;
alter table public.documents      enable row level security;
alter table public.audit_log      enable row level security;

-- ---------- สรุปรายชิ้นงาน ----------
create or replace function public.parts_summary(p_system text)
returns table (
  part_code  text,
  part_name  text,
  cats       int[],
  first_at   timestamptz,
  last_at    timestamptz,
  files      int,
  size_kb    bigint
)
language sql stable
set search_path = public
as $$
  select d.part_code,
         (array_agg(d.part_name order by d.uploaded_at desc))[1],
         array_agg(distinct d.category_no order by d.category_no),
         min(d.uploaded_at), max(d.uploaded_at), count(*)::int, coalesce(sum(d.size_kb), 0)
  from public.documents d
  where d.system = p_system and d.status = 'active'
  group by d.part_code
  order by max(d.uploaded_at) desc
$$;

-- ---------- ข้อมูลแดชบอร์ดทั้งหมดในครั้งเดียว ----------
create or replace function public.dashboard_summary()
returns jsonb
language sql stable
set search_path = public
as $$
  with mp as (select * from public.parts_summary('main')),
       tp as (select * from public.parts_summary('test')),
       cat_names(no, name) as (values
         (1,'ใบรับรองความต้องการ'),(2,'Sketch Design'),(3,'3D Drawing'),(4,'2D Drawing'),
         (5,'ใบบันทึกผลการตรวจสอบเบื้องต้น'),(6,'ใบขอทดสอบแม่พิมพ์'),
         (7,'ใบบันทึกผลตรวจสอบและรับรองผลิตภัณฑ์'),(8,'ใบบันทึกผลการทดสอบ'),(9,'ใบมาตรฐานสินค้าและผลิตภัณฑ์'))
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'mainParts', (select count(*) from mp),
      'mainFiles', (select coalesce(sum(files), 0) from mp),
      'testParts', (select count(*) from tp),
      'testFiles', (select coalesce(sum(files), 0) from tp),
      'newMainParts', (select count(*) from mp where first_at >= now() - interval '7 days'),
      'newTestParts', (select count(*) from tp where first_at >= now() - interval '7 days'),
      'systemKB', (select coalesce(sum(size_kb), 0) from mp) + (select coalesce(sum(size_kb), 0) from tp)
    ),
    'completeness', jsonb_build_object(
      'total', (select count(*) from mp),
      'full', (select count(*) from mp where cardinality(cats) >= 9),
      'mid',  (select count(*) from mp where cardinality(cats) between 5 and 8),
      'low',  (select count(*) from mp where cardinality(cats) < 5)
    ),
    'incompleteTotal', (select count(*) from mp where cardinality(cats) < 9),
    'incomplete', coalesce((
      select jsonb_agg(x order by x.last_at desc) from (
        select mp.part_code as "partCode", mp.part_name as "partName", cardinality(mp.cats) as filled,
               mp.last_at,
               (select jsonb_agg(jsonb_build_object('no', c.no, 'name', c.name) order by c.no)
                  from cat_names c where not (c.no = any(mp.cats))) as missing
        from mp where cardinality(mp.cats) < 9
        order by mp.last_at desc limit 5
      ) x), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by r."uploadedAt" desc) from (
        select d.system, d.part_code as "partCode", d.file_name as "fileName", d.file_url as "fileUrl",
               d.category_no as "categoryNo", d.category_name as "categoryName",
               d.uploader, d.uploaded_at as "uploadedAt"
        from public.documents d where d.status = 'active'
        order by d.uploaded_at desc limit 5
      ) r), '[]'::jsonb)
  )
$$;

-- ฟังก์ชันเหล่านี้เรียกได้เฉพาะ service role
revoke all on function public.parts_summary(text) from public, anon, authenticated;
revoke all on function public.dashboard_summary() from public, anon, authenticated;
