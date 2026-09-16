-- ====================================================================
-- تحديث قاعدة بيانات Supabase: إضافة حقول تتبع ومزامنة حالة نسك مسار
-- ====================================================================
-- قم بنسخ هذا الكود ولصقه في:
-- Supabase Dashboard -> SQL Editor -> New query -> Run
-- ====================================================================

-- 1. إضافة حقول حالة نسك وتاريخ آخر مزامنة لجدول المعاملات
alter table public.group_requests
add column if not exists nusuk_status text,
add column if not exists nusuk_synced_at timestamptz;

-- 2. توثيق الحقول
comment on column public.group_requests.nusuk_status is 'حالة المجموعة في منصة نسك مسار (مثل: تحت الإدخال، تم الإرسال للمخاع، بانتظار سداد التأشيرات، تم إصدار التأشيرات)';
comment on column public.group_requests.nusuk_synced_at is 'تاريخ ووقت آخر مزامنة لحالة المجموعة مع نسك مسار';
