-- ====================================================================
-- سكربت شامل متكامل (إنشاء الجداول + إعداد السيرفر + نقل بياناتك كاملة)
-- نظام مسار الحج والعمرة
-- ====================================================================
-- طريقة الاستخدام:
-- 1. افتح Supabase Dashboard -> اضغط على SQL Editor في القائمة اليسرى
-- 2. الصق هذا الكود بالكامل واضغط زر Run الأخضر
-- ====================================================================

-- 1. جدول المستخدمين والحسابات
create table if not exists public.app_users (
    id text primary key,
    username text unique not null,
    password text not null,
    full_name text not null,
    role text not null check (role in ('Sender', 'SafaEmployee', 'SaudiAgent', 'Admin')),
    phone text,
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

drop policy if exists "Public Access for hajj-documents" on storage.objects;
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

drop policy if exists "Allow all for anon on app_users" on public.app_users;
create policy "Allow all for anon on app_users" on public.app_users for all using (true) with check (true);

drop policy if exists "Allow all for anon on group_requests" on public.group_requests;
create policy "Allow all for anon on group_requests" on public.group_requests for all using (true) with check (true);

drop policy if exists "Allow all for anon on hosting_infos" on public.hosting_infos;
create policy "Allow all for anon on hosting_infos" on public.hosting_infos for all using (true) with check (true);

drop policy if exists "Allow all for anon on travelers" on public.travelers;
create policy "Allow all for anon on travelers" on public.travelers for all using (true) with check (true);

drop policy if exists "Allow all for anon on documents" on public.documents;
create policy "Allow all for anon on documents" on public.documents for all using (true) with check (true);

drop policy if exists "Allow all for anon on correction_requests" on public.correction_requests;
create policy "Allow all for anon on correction_requests" on public.correction_requests for all using (true) with check (true);

drop policy if exists "Allow all for anon on status_histories" on public.status_histories;
create policy "Allow all for anon on status_histories" on public.status_histories for all using (true) with check (true);

drop policy if exists "Allow all for anon on audit_logs" on public.audit_logs;
create policy "Allow all for anon on audit_logs" on public.audit_logs for all using (true) with check (true);

-- ====================================================================
-- 11. تفعيل البث اللحظي (Realtime) لتحديث كافة الأجهزة تلقائياً
-- ====================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_requests') then
    alter publication supabase_realtime add table public.group_requests;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'travelers') then
    alter publication supabase_realtime add table public.travelers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'correction_requests') then
    alter publication supabase_realtime add table public.correction_requests;
  end if;
end $$;

-- ====================================================================
-- 12. إدخال ونقل بيانات المستخدمين الحالية من متصفحك
-- ====================================================================
insert into public.app_users (id, username, password, full_name, role, phone, is_active, created_at)
values
  ('usr-admin-1', 'Admin', 'Admin@hajj', 'عمر محمد', 'Admin', '+201110550202', true, '2026-01-01T08:00:00.000Z'),
  ('usr-1789292153357', 'Mo_safa', 'Safa@hajj', 'محمد عبدالعزيز', 'SafaEmployee', '+201150040139', true, '2026-09-13T09:35:53.357Z'),
  ('usr-1789292253978', 'Ah_sender', 'Sender@hajj', 'أحمد الهدهد', 'Sender', '+201002733773', true, '2026-09-13T09:37:33.979Z'),
  ('usr-1789292340503', 'Yu_agent', 'Agent@hajj', 'أبو يوسف', 'SaudiAgent', '+966545743501', true, '2026-09-13T09:39:00.503Z')
on conflict (id) do update set
  username = excluded.username,
  password = excluded.password,
  full_name = excluded.full_name,
  role = excluded.role,
  phone = excluded.phone,
  is_active = excluded.is_active;

-- ====================================================================
-- 13. إدخال ونقل كافة المعاملات والمجموعات (REQ-001, REQ-002, REQ-003)
-- ====================================================================
insert into public.group_requests (
  id, request_number, group_name, sender_id, sender_name, status,
  has_hosting, contact_phone, travel_date, departure_date, return_date,
  flight_departure_time, airport_arrival_time, destination, nusuk_group_number,
  flight_ticket_document_id, airline, flight_number, created_at, updated_at, completed_at
)
values
  (
    'req-1789299944956', 'REQ-2026-003', 'معاملة جديدة - REQ-2026-003',
    'usr-admin-1', 'عمر محمد', 'Completed',
    true, '+966563044912', '2026-09-20', '2026-09-20', '2026-12-08',
    '16:05', '13:05', 'مكة المكرمة والمدينة المنورة', '480900978506',
    'doc-1789324400583', 'Saudia', 'SV418',
    '2026-09-13T11:45:44.956Z', '2026-09-13T18:33:24.701Z', '2026-09-13T11:46:27.318Z'
  ),
  (
    'req-1789299608778', 'REQ-2026-002', 'معاملة جديدة - REQ-2026-002',
    'usr-admin-1', 'عمر محمد', 'Completed',
    true, '0552232869', '2026-09-15', '2026-09-15', '2026-11-29',
    '15:20', '12:20', 'مكة المكرمة والمدينة المنورة', '480900977136',
    'doc-1789324491793', 'Egyptair', 'MS 671',
    '2026-09-13T11:40:08.777Z', '2026-09-13T21:34:29.307Z', '2026-09-13T11:40:37.527Z'
  ),
  (
    'req-1789299422330', 'REQ-2026-001', 'معاملة جديدة - REQ-2026-001',
    'usr-admin-1', 'عمر محمد', 'Completed',
    true, '0543052730', '2026-09-23', '2026-09-23', '2026-12-12',
    '16:40', '13:40', 'مكة المكرمة والمدينة المنورة', '480900976202',
    'doc-1789324439916', 'Saudia', 'SV314',
    '2026-09-13T11:37:02.330Z', '2026-09-13T18:34:08.053Z', '2026-09-13T11:37:40.637Z'
  )
on conflict (id) do update set
  request_number = excluded.request_number,
  group_name = excluded.group_name,
  sender_id = excluded.sender_id,
  sender_name = excluded.sender_name,
  status = excluded.status,
  has_hosting = excluded.has_hosting,
  contact_phone = excluded.contact_phone,
  travel_date = excluded.travel_date,
  departure_date = excluded.departure_date,
  return_date = excluded.return_date,
  flight_departure_time = excluded.flight_departure_time,
  airport_arrival_time = excluded.airport_arrival_time,
  destination = excluded.destination,
  nusuk_group_number = excluded.nusuk_group_number,
  flight_ticket_document_id = excluded.flight_ticket_document_id,
  airline = excluded.airline,
  flight_number = excluded.flight_number,
  updated_at = excluded.updated_at,
  completed_at = excluded.completed_at;

-- ====================================================================
-- 14. إدخال ونقل بيانات الاستضافة
-- ====================================================================
insert into public.hosting_infos (
  id, group_request_id, host_name, host_phone, host_birth_date,
  host_nationality, host_national_id, host_address, host_id_document_id
)
values
  (
    'host-1789299944956', 'req-1789299944956', 'ايمن مشعل نديم احمد', '+966563044912', '1997/01/05',
    'مصر', '2615597941', '', 'doc-1789299945121'
  ),
  (
    'host-1789299608778', 'req-1789299608778', 'رغده مدحت محمد عبد الفتاح', '0552232869', '1992/05/03',
    null, null, '', 'doc-1789299608944'
  ),
  (
    'host-1789299422330', 'req-1789299422330', 'أحمد عصام الدين عبدالله عبدالحليم', '0543052730', '1993/05/06',
    null, null, '', 'doc-1789299422495'
  )
on conflict (id) do update set
  host_name = excluded.host_name,
  host_phone = excluded.host_phone,
  host_birth_date = excluded.host_birth_date,
  host_nationality = excluded.host_nationality,
  host_national_id = excluded.host_national_id,
  host_address = excluded.host_address,
  host_id_document_id = excluded.host_id_document_id;

-- ====================================================================
-- 15. إدخال ونقل المسافرين والمعتمرين
-- ====================================================================
insert into public.travelers (
  id, group_request_id, full_name, passport_number, nationality, date_of_birth, status, created_at
)
values
  (
    'trv-1789299945315', 'req-1789299944956', 'أحمد عبده طه عبده الرفاعي',
    'A37712514', 'مصري', '2004-01-15', 'Pending', '2026-09-13T11:45:45.315Z'
  ),
  (
    'trv-1789299609139', 'req-1789299608778', 'سمر محمد رشاد محمود محمد',
    'A45525597', 'سعودي', null, 'Pending', '2026-09-13T11:40:09.139Z'
  ),
  (
    'trv-1789299422686', 'req-1789299422330', 'هاجر مصباح صديق عامر المصري',
    'A46379299', 'EGY', null, 'Pending', '2026-09-13T11:37:02.686Z'
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  passport_number = excluded.passport_number,
  nationality = excluded.nationality,
  date_of_birth = excluded.date_of_birth,
  status = excluded.status;

-- ====================================================================
-- 16. إدخال ونقل سجلات المستندات والمرفقات
-- ====================================================================
insert into public.documents (
  id, group_request_id, traveler_id, document_type, original_file_name,
  file_size, mime_type, version, uploaded_by_id, uploaded_by_name,
  uploaded_at, review_status, review_note
)
values
  -- وثائق المعاملة REQ-2026-003
  ('doc-1789299945121', 'req-1789299944956', null, 'HostId', 'WhatsApp Image 2026-09-13 at 5.36.15 AM.jpeg', 109110, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:45:45.121Z', 'Accepted', null),
  ('doc-1789324400583', 'req-1789299944956', null, 'FlightTicket', 'FlightTicket_REQ-003.pdf', 144651, 'application/pdf', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T18:33:20.584Z', 'Accepted', null),
  ('doc-1789299945488', 'req-1789299944956', 'trv-1789299945315', 'Passport', 'WhatsApp Image 2026-09-13 at 5.36.17 AM.jpeg', 126126, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:45:45.488Z', 'Accepted', null),
  ('doc-1789299945671', 'req-1789299944956', 'trv-1789299945315', 'PersonalPhoto', 'WhatsApp Image 2026-09-13 at 5.36.16 AM.jpeg', 133698, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:45:45.671Z', 'Accepted', null),
  ('doc-1789299945854', 'req-1789299944956', 'trv-1789299945315', 'FlightTicket', 'FlightTicket_REQ-003.pdf', 144651, 'application/pdf', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:45:45.854Z', 'Accepted', null),

  -- وثائق المعاملة REQ-2026-002
  ('doc-1789299608944', 'req-1789299608778', null, 'HostId', 'WhatsApp Image 2026-09-13 at 2.04.26 AM (1).jpeg', 289838, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:40:08.944Z', 'Accepted', null),
  ('doc-1789324491793', 'req-1789299608778', null, 'FlightTicket', 'EGYPTAIR - .pdf', 141337, 'application/pdf', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T18:34:51.793Z', 'Pending', 'تمت إعادة المستند للمراجعة من قبل الوكيل'),
  ('doc-1789299609311', 'req-1789299608778', 'trv-1789299609139', 'Passport', 'WhatsApp Image 2026-09-13 at 2.04.25 AM.jpeg', 134667, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:40:09.311Z', 'Accepted', null),
  ('doc-1789299609495', 'req-1789299608778', 'trv-1789299609139', 'PersonalPhoto', 'WhatsApp Image 2026-09-13 at 2.04.25 AM (1).jpeg', 89249, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:40:09.495Z', 'Accepted', null),
  ('doc-1789299609678', 'req-1789299608778', 'trv-1789299609139', 'FlightTicket', 'EGYPTAIR - .pdf', 141337, 'application/pdf', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:40:09.678Z', 'Accepted', null),

  -- وثائق المعاملة REQ-2026-001
  ('doc-1789299422495', 'req-1789299422330', null, 'HostId', 'WhatsApp Image 2026-09-12 at 7.39.36 PM.jpeg', 186271, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:37:02.495Z', 'Accepted', null),
  ('doc-1789324439916', 'req-1789299422330', null, 'FlightTicket', 'FlightTicket_REQ-001.pdf', 146044, 'application/pdf', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T18:33:59.917Z', 'Accepted', null),
  ('doc-1789299422863', 'req-1789299422330', 'trv-1789299422686', 'Passport', 'WhatsApp Image 2026-09-12 at 7.39.32 PM.jpeg', 102255, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:37:02.863Z', 'Accepted', null),
  ('doc-1789299423046', 'req-1789299422330', 'trv-1789299422686', 'PersonalPhoto', 'WhatsApp Image 2026-09-12 at 7.39.30 PM.jpeg', 169415, 'image/jpeg', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:37:03.046Z', 'Accepted', null),
  ('doc-1789299423227', 'req-1789299422330', 'trv-1789299422686', 'FlightTicket', 'FlightTicket_REQ-001.pdf', 146044, 'application/pdf', 1, 'usr-admin-1', 'عمر محمد', '2026-09-13T11:37:03.227Z', 'Accepted', null)
on conflict (id) do update set
  review_status = excluded.review_status,
  review_note = excluded.review_note;

-- ====================================================================
-- 17. إدخال سجل تتبع الحالات
-- ====================================================================
insert into public.status_histories (
  id, group_request_id, from_status, to_status, changed_by_id, changed_by_name, note, created_at
)
values
  -- حالات REQ-2026-003
  ('sh-1789299944956', 'req-1789299944956', 'Draft', 'Draft', 'usr-admin-1', 'عمر محمد', 'إنشاء مسودة المعاملة', '2026-09-13T11:45:44.956Z'),
  ('sh-1789299946038', 'req-1789299944956', 'Draft', 'Submitted', 'usr-admin-1', 'عمر محمد', 'تم تقديم المعاملة للمراجعة والتدقيق', '2026-09-13T11:45:46.039Z'),
  ('sh-1789299968932', 'req-1789299944956', 'Submitted', 'UnderReview', 'usr-admin-1', 'عمر محمد', 'بدء مراجعة وتدقيق المعاملة', '2026-09-13T11:46:08.932Z'),
  ('sh-1789299978690', 'req-1789299944956', 'UnderReview', 'SafaRegistrationCompleted', 'usr-admin-1', 'عمر محمد', 'تم إكمال تسجيل الصفا وتوليد رقم نسك: 480900978506', '2026-09-13T11:46:18.690Z'),
  ('sh-1789299982570', 'req-1789299944956', 'SafaRegistrationCompleted', 'ReadyForSaudiAgent', 'usr-admin-1', 'عمر محمد', 'إحالة المجموعة للوكيل السعودي للمصادقة', '2026-09-13T11:46:22.570Z'),
  ('sh-1789299983414', 'req-1789299944956', 'ReadyForSaudiAgent', 'ReceivedBySaudiAgent', 'usr-admin-1', 'عمر محمد', 'تم تأكيد استلام المعاملة من قبل الوكيل السعودي', '2026-09-13T11:46:23.414Z'),
  ('sh-1789299984070', 'req-1789299944956', 'ReceivedBySaudiAgent', 'ProgramLinked', 'usr-admin-1', 'عمر محمد', 'تم ربط البرنامج بنجاح من قبل الوكيل السعودي', '2026-09-13T11:46:24.070Z'),
  ('sh-1789299984565', 'req-1789299944956', 'ProgramLinked', 'HostingAcceptanceRequested', 'usr-admin-1', 'عمر محمد', 'تم إرسال طلب قبول الاستضافة إلى المرسل للموافقة والتأكيد', '2026-09-13T11:46:24.565Z'),
  ('sh-1789299985197', 'req-1789299944956', 'HostingAcceptanceRequested', 'HostingAcceptedBySender', 'usr-admin-1', 'عمر محمد', 'تم قبول طلب الاستضافة من قبل المرسل', '2026-09-13T11:46:25.197Z'),
  ('sh-1789299985726', 'req-1789299944956', 'HostingAcceptedBySender', 'HostingConfirmed', 'usr-admin-1', 'عمر محمد', 'تم تأكيد الاستضافة وإحالتها للوكيل السعودي للاعتماد النهائي', '2026-09-13T11:46:25.726Z'),
  ('sh-1789299987318', 'req-1789299944956', 'HostingConfirmed', 'Completed', 'usr-admin-1', 'عمر محمد', 'تم إنجاز كافة التأشيرات والخدمات بنجاح', '2026-09-13T11:46:27.318Z'),

  -- حالات REQ-2026-002
  ('sh-1789299608778', 'req-1789299608778', 'Draft', 'Draft', 'usr-admin-1', 'عمر محمد', 'إنشاء مسودة المعاملة', '2026-09-13T11:40:08.777Z'),
  ('sh-1789299609862', 'req-1789299608778', 'Draft', 'Submitted', 'usr-admin-1', 'عمر محمد', 'تم تقديم المعاملة للمراجعة والتدقيق', '2026-09-13T11:40:09.862Z'),
  ('sh-1789299618840', 'req-1789299608778', 'Submitted', 'UnderReview', 'usr-admin-1', 'عمر محمد', 'بدء مراجعة وتدقيق المعاملة', '2026-09-13T11:40:18.840Z'),
  ('sh-1789299627892', 'req-1789299608778', 'UnderReview', 'SafaRegistrationCompleted', 'usr-admin-1', 'عمر محمد', 'تم إكمال تسجيل الصفا وتوليد رقم نسك: 480900977136', '2026-09-13T11:40:27.892Z'),
  ('sh-1789299632646', 'req-1789299608778', 'SafaRegistrationCompleted', 'ReadyForSaudiAgent', 'usr-admin-1', 'عمر محمد', 'إحالة المجموعة للوكيل السعودي للمصادقة', '2026-09-13T11:40:32.646Z'),
  ('sh-1789299633526', 'req-1789299608778', 'ReadyForSaudiAgent', 'ReceivedBySaudiAgent', 'usr-admin-1', 'عمر محمد', 'تم تأكيد استلام المعاملة من قبل الوكيل السعودي', '2026-09-13T11:40:33.526Z'),
  ('sh-1789299634225', 'req-1789299608778', 'ReceivedBySaudiAgent', 'ProgramLinked', 'usr-admin-1', 'عمر محمد', 'تم ربط البرنامج بنجاح من قبل الوكيل السعودي', '2026-09-13T11:40:34.225Z'),
  ('sh-1789299634786', 'req-1789299608778', 'ProgramLinked', 'HostingAcceptanceRequested', 'usr-admin-1', 'عمر محمد', 'تم إرسال طلب قبول الاستضافة إلى المرسل للموافقة والتأكيد', '2026-09-13T11:40:34.786Z'),
  ('sh-1789299635335', 'req-1789299608778', 'HostingAcceptanceRequested', 'HostingAcceptedBySender', 'usr-admin-1', 'عمر محمد', 'تم قبول طلب الاستضافة من قبل المرسل', '2026-09-13T11:40:35.335Z'),
  ('sh-1789299635865', 'req-1789299608778', 'HostingAcceptedBySender', 'HostingConfirmed', 'usr-admin-1', 'عمر محمد', 'تم تأكيد الاستضافة وإحالتها للوكيل السعودي للاعتماد النهائي', '2026-09-13T11:40:35.865Z'),
  ('sh-1789299637527', 'req-1789299608778', 'HostingConfirmed', 'Completed', 'usr-admin-1', 'عمر محمد', 'تم إنجاز كافة التأشيرات والخدمات بنجاح', '2026-09-13T11:40:37.527Z'),

  -- حالات REQ-2026-001
  ('sh-1789299422330', 'req-1789299422330', 'Draft', 'Draft', 'usr-admin-1', 'عمر محمد', 'إنشاء مسودة المعاملة', '2026-09-13T11:37:02.330Z'),
  ('sh-1789299423414', 'req-1789299422330', 'Draft', 'Submitted', 'usr-admin-1', 'عمر محمد', 'تم تقديم المعاملة للمراجعة والتدقيق', '2026-09-13T11:37:03.414Z'),
  ('sh-1789299433567', 'req-1789299422330', 'Submitted', 'UnderReview', 'usr-admin-1', 'عمر محمد', 'بدء مراجعة وتدقيق المعاملة', '2026-09-13T11:37:13.567Z'),
  ('sh-1789299443221', 'req-1789299422330', 'UnderReview', 'SafaRegistrationCompleted', 'usr-admin-1', 'عمر محمد', 'تم إكمال تسجيل الصفا وتوليد رقم نسك: 480900976202', '2026-09-13T11:37:23.221Z'),
  ('sh-1789299445981', 'req-1789299422330', 'SafaRegistrationCompleted', 'ReadyForSaudiAgent', 'usr-admin-1', 'عمر محمد', 'إحالة المجموعة للوكيل السعودي للمصادقة', '2026-09-13T11:37:25.981Z'),
  ('sh-1789299447554', 'req-1789299422330', 'ReadyForSaudiAgent', 'ReceivedBySaudiAgent', 'usr-admin-1', 'عمر محمد', 'تم تأكيد استلام المعاملة من قبل الوكيل السعودي', '2026-09-13T11:37:27.554Z'),
  ('sh-1789299455932', 'req-1789299422330', 'ReceivedBySaudiAgent', 'ProgramLinked', 'usr-admin-1', 'عمر محمد', 'تم ربط البرنامج بنجاح من قبل الوكيل السعودي', '2026-09-13T11:37:35.932Z'),
  ('sh-1789299456887', 'req-1789299422330', 'ProgramLinked', 'HostingAcceptanceRequested', 'usr-admin-1', 'عمر محمد', 'تم إرسال طلب قبول الاستضافة إلى المرسل للموافقة والتأكيد', '2026-09-13T11:37:36.887Z'),
  ('sh-1789299458182', 'req-1789299422330', 'HostingAcceptanceRequested', 'HostingAcceptedBySender', 'usr-admin-1', 'عمر محمد', 'تم قبول طلب الاستضافة من قبل المرسل', '2026-09-13T11:37:38.182Z'),
  ('sh-1789299458932', 'req-1789299422330', 'HostingAcceptedBySender', 'HostingConfirmed', 'usr-admin-1', 'عمر محمد', 'تم تأكيد الاستضافة وإحالتها للوكيل السعودي للاعتماد النهائي', '2026-09-13T11:37:38.932Z'),
  ('sh-1789299460637', 'req-1789299422330', 'HostingConfirmed', 'Completed', 'usr-admin-1', 'عمر محمد', 'تم إنجاز كافة التأشيرات والخدمات بنجاح', '2026-09-13T11:37:40.637Z')
on conflict (id) do nothing;
