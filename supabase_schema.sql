-- ====================================================================
-- سكربت قاعدة بيانات نظام إدارة وتدقيق معاملات الحج والعمرة (Supabase)
-- ====================================================================
-- قم بنسخ هذا السكربت كاملاً ولصقه في:
-- Supabase Dashboard -> SQL Editor -> New query -> Run
-- ====================================================================

-- 1. جدول المستخدمين والحسابات
create table if not exists public.app_users (
    id text primary key,
    username text unique not null,
    password text not null,
    full_name text not null,
    role text not null check (role in ('Sender', 'SafaEmployee', 'SaudiAgent', 'Admin')),
    phone text,
    sender_code text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    last_login_at timestamptz
);

-- 2. جدول المعاملات والمجموعات
create table if not exists public.group_requests (
    id text primary key,
    request_number text unique not null,
    group_name text not null,
    sender_id text,
    sender_name text,
    sender_code text,
    assigned_safa_employee_id text,
    assigned_safa_employee_name text,
    assigned_saudi_agent_id text,
    assigned_saudi_agent_name text,
    status text not null default 'Draft',
    nusuk_group_number text,
    has_hosting boolean not null default false,
    contact_phone text,
    travel_date text,
    departure_date text,
    return_date text,
    flight_departure_time text,
    airport_arrival_time text,
    airline text,
    flight_number text,
    flight_ticket_document_id text,
    destination text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

-- 3. جدول بيانات الاستضافة
create table if not exists public.hosting_infos (
    id text primary key,
    group_request_id text not null references public.group_requests(id) on delete cascade,
    host_name text,
    host_phone text,
    host_birth_date text,
    host_nationality text,
    host_national_id text,
    host_address text,
    host_id_document_id text
);

-- 4. جدول المسافرين
create table if not exists public.travelers (
    id text primary key,
    group_request_id text not null references public.group_requests(id) on delete cascade,
    full_name text not null,
    passport_number text,
    phone_number text,
    nationality text,
    date_of_birth text,
    status text not null default 'Pending',
    notes text,
    created_at timestamptz not null default now()
);

-- 5. جدول المستندات والوثائق
create table if not exists public.documents (
    id text primary key,
    group_request_id text references public.group_requests(id) on delete cascade,
    traveler_id text references public.travelers(id) on delete cascade,
    document_type text not null check (document_type in ('Passport', 'PersonalPhoto', 'FlightTicket', 'HostId', 'Other')),
    original_file_name text not null,
    file_size bigint not null default 0,
    mime_type text,
    version int not null default 1,
    uploaded_by_id text,
    uploaded_by_name text,
    uploaded_at timestamptz not null default now(),
    review_status text not null default 'Pending' check (review_status in ('Pending', 'Accepted', 'Rejected', 'NeedsCorrection', 'Missing')),
    review_note text,
    storage_path text,
    storage_url text
);

-- 6. جدول طلبات التصحيح
create table if not exists public.correction_requests (
    id text primary key,
    group_request_id text not null references public.group_requests(id) on delete cascade,
    traveler_id text,
    traveler_name text,
    document_id text,
    target_field text,
    requested_by_id text,
    requested_by_name text,
    assigned_to_id text,
    assigned_to_name text,
    reason text not null,
    status text not null default 'Pending' check (status in ('Pending', 'Resolved', 'Cancelled')),
    resolution_notes text,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

-- 7. جدول سجل تتبع الحالات
create table if not exists public.status_histories (
    id text primary key,
    group_request_id text not null references public.group_requests(id) on delete cascade,
    from_status text not null,
    to_status text not null,
    changed_by_id text,
    changed_by_name text,
    note text,
    created_at timestamptz not null default now()
);

-- 8. جدول سجل النشاطات (Audit Logs)
create table if not exists public.audit_logs (
    id text primary key,
    user_id text,
    username text,
    user_role text,
    action text not null,
    entity_name text,
    entity_id text,
    ip_address text,
    metadata_json text,
    created_at timestamptz not null default now()
);

-- ====================================================================
-- 9. إعداد حاوية تخزين المستندات (Storage Bucket)
-- ====================================================================
insert into storage.buckets (id, name, public)
values ('hajj-documents', 'hajj-documents', true)
on conflict (id) do update set public = true;

-- سياسات الوصول للملفات في Storage
create policy "Public Access for hajj-documents"
on storage.objects for all
using (bucket_id = 'hajj-documents')
with check (bucket_id = 'hajj-documents');

-- ====================================================================
-- 10. تفعيل الصلاحيات وسياسات الأمان (Row Level Security - RLS)
-- ====================================================================
alter table public.app_users enable row level security;
alter table public.group_requests enable row level security;
alter table public.hosting_infos enable row level security;
alter table public.travelers enable row level security;
alter table public.documents enable row level security;
alter table public.correction_requests enable row level security;
alter table public.status_histories enable row level security;
alter table public.audit_logs enable row level security;

-- السماح بالوصول الكامل بواسطة مفتاح الـ Anon للموقع
create policy "Allow all for anon on app_users" on public.app_users for all using (true) with check (true);
create policy "Allow all for anon on group_requests" on public.group_requests for all using (true) with check (true);
create policy "Allow all for anon on hosting_infos" on public.hosting_infos for all using (true) with check (true);
create policy "Allow all for anon on travelers" on public.travelers for all using (true) with check (true);
create policy "Allow all for anon on documents" on public.documents for all using (true) with check (true);
create policy "Allow all for anon on correction_requests" on public.correction_requests for all using (true) with check (true);
create policy "Allow all for anon on status_histories" on public.status_histories for all using (true) with check (true);
create policy "Allow all for anon on audit_logs" on public.audit_logs for all using (true) with check (true);

-- ====================================================================
-- 11. تفعيل البث اللحظي (Realtime) لتحديث كافة الأجهزة تلقائياً
-- ====================================================================
alter publication supabase_realtime add table public.group_requests;
alter publication supabase_realtime add table public.travelers;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.correction_requests;

-- ====================================================================
-- 12. بيانات المستخدمين الافتراضية
-- ====================================================================
insert into public.app_users (id, username, password, full_name, role, phone, is_active)
values 
  ('usr-admin-1', 'admin', 'admin123', 'مدير النظام الرئيسي', 'Admin', '0500000001', true),
  ('usr-safa-1', 'safa1', 'safa123', 'عبدالله السعيد (موظف صفا)', 'SafaEmployee', '0500000002', true),
  ('usr-agent-1', 'agent1', 'agent123', 'شركة الهدى (وكيل سعودي)', 'SaudiAgent', '0500000003', true),
  ('usr-sender-1', 'sender1', 'sender123', 'أحمد المحمدي (مرسل)', 'Sender', '0500000004', true)
on conflict (username) do nothing;

-- ====================================================================
-- 13. ترقية الجداول القائمة تلقائياً (Migrations)
-- ====================================================================
alter table if exists public.app_users add column if not exists sender_code text;
alter table if exists public.group_requests add column if not exists sender_code text;

-- ====================================================================
-- 14. جدول إعدادات النظام ومفتاح الذكاء الاصطناعي المركزي (System Settings)
-- ====================================================================
create table if not exists public.system_settings (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;
create policy "Allow all for anon on system_settings" on public.system_settings for all using (true) with check (true);
alter publication supabase_realtime add table public.system_settings;

