-- TUTOR-SPACE MVP initial schema.
-- Scope: tutor auth profile, students, lessons, homework submissions,
-- homework photos metadata, lightweight update indicators, and private Storage bucket.
-- Out of scope for this migration: payments/subscriptions, platform admin,
-- exports, SMS, external notifications, multilingual content, and multi-tutor students.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'student_status') then
    create type public.student_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'homework_status') then
    create type public.homework_status as enum (
      'not_submitted',
      'in_review',
      'checked',
      'needs_correction'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'material_type') then
    create type public.material_type as enum (
      'note',
      'video',
      'presentation',
      'board',
      'taskbook',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'update_event_type') then
    create type public.update_event_type as enum (
      'lesson_created',
      'homework_changed',
      'review_comment_added',
      'homework_status_changed',
      'material_added'
    );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutors_email_not_blank check (length(btrim(email)) > 0),
  constraint tutors_name_not_blank check (length(btrim(name)) > 0),
  constraint tutors_phone_not_blank check (length(btrim(phone)) > 0)
);

comment on table public.tutors is 'Tutor profile linked to Supabase Auth user.';
comment on column public.tutors.auth_user_id is 'References auth.users.id; used by RLS to isolate tutor data.';

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  name text not null,
  subject text not null,
  grade text,
  student_contact text,
  parent_contact text,
  lesson_price numeric(10, 2),
  lesson_duration_minutes integer,
  comment text,
  status public.student_status not null default 'active',
  access_token_hash text not null unique,
  access_token_created_at timestamptz not null default now(),
  schedule_text text,
  goals_text text,
  meeting_url text,
  has_unread_updates_for_student boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint students_name_not_blank check (length(btrim(name)) > 0),
  constraint students_subject_not_blank check (length(btrim(subject)) > 0),
  constraint students_token_hash_not_blank check (length(btrim(access_token_hash)) > 0),
  constraint students_lesson_price_non_negative check (lesson_price is null or lesson_price >= 0),
  constraint students_lesson_duration_positive check (
    lesson_duration_minutes is null or lesson_duration_minutes > 0
  ),
  constraint students_archived_at_matches_status check (
    (status = 'archived' and archived_at is not null)
    or (status = 'active' and archived_at is null)
  )
);

comment on table public.students is 'Students owned by a tutor. Students are archived, not physically deleted in normal MVP flow.';
comment on column public.students.access_token_hash is 'Hash of the student access token. Plaintext access token must never be stored.';

create table if not exists public.useful_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint useful_links_title_not_blank check (length(btrim(title)) > 0),
  constraint useful_links_url_not_blank check (length(btrim(url)) > 0),
  constraint useful_links_sort_order_non_negative check (sort_order >= 0)
);

comment on table public.useful_links is 'Persistent named links shown in a student profile.';

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_date date not null,
  topic text not null,
  comprehension_rating integer,
  homework_text text,
  homework_deadline date,
  homework_status public.homework_status not null default 'not_submitted',
  homework_review_comment text,
  homework_first_submitted_at timestamptz,
  homework_late_days integer,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lessons_topic_not_blank check (length(btrim(topic)) > 0),
  constraint lessons_rating_range check (
    comprehension_rating is null
    or (comprehension_rating between 1 and 5)
  ),
  constraint lessons_late_days_non_negative check (
    homework_late_days is null or homework_late_days >= 0
  ),
  constraint lessons_late_days_requires_deadline check (
    homework_late_days is null or homework_deadline is not null
  ),
  constraint lessons_id_student_id_unique unique (id, student_id)
);

comment on table public.lessons is 'Lesson history for a student. deleted_at supports soft delete for MVP safety.';
comment on column public.lessons.homework_late_days is 'Late days counted from homework_deadline to first homework submission; recalculation is application/RPC logic.';

create table if not exists public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  url text not null,
  material_type public.material_type not null default 'other',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_materials_title_not_blank check (length(btrim(title)) > 0),
  constraint lesson_materials_url_not_blank check (length(btrim(url)) > 0),
  constraint lesson_materials_sort_order_non_negative check (sort_order >= 0)
);

comment on table public.lesson_materials is 'External lesson material links only; file uploads by tutors are Post-MVP.';

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  comment text,
  submitted_at timestamptz not null default now(),
  is_revision boolean not null default false,
  created_at timestamptz not null default now(),
  constraint homework_submissions_lesson_student_unique_pair check (lesson_id is not null and student_id is not null),
  constraint homework_submissions_lesson_matches_student foreign key (lesson_id, student_id)
    references public.lessons(id, student_id)
    on delete cascade
);

comment on table public.homework_submissions is 'Homework submissions from student, including revisions.';
comment on column public.homework_submissions.is_revision is 'True when this submission is a correction after an earlier submission.';

create table if not exists public.homework_submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.homework_submissions(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint homework_photos_storage_path_not_blank check (length(btrim(storage_path)) > 0),
  constraint homework_photos_mime_type_not_blank check (length(btrim(mime_type)) > 0),
  constraint homework_photos_size_positive check (size_bytes > 0),
  constraint homework_photos_width_positive check (width is null or width > 0),
  constraint homework_photos_height_positive check (height is null or height > 0),
  constraint homework_photos_sort_order_non_negative check (sort_order >= 0)
);

comment on table public.homework_submission_photos is 'Metadata for private Storage photos attached to homework submissions.';
comment on column public.homework_submission_photos.storage_path is 'Path in private Supabase Storage bucket homework-photos.';

create table if not exists public.update_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  event_type public.update_event_type not null,
  is_seen_by_student boolean not null default false,
  created_at timestamptz not null default now(),
  constraint update_events_lesson_matches_student foreign key (lesson_id, student_id)
    references public.lessons(id, student_id)
    on delete cascade
);

comment on table public.update_events is 'Lightweight internal update events for the student unread indicator.';

create index if not exists idx_tutors_auth_user_id on public.tutors(auth_user_id);
create index if not exists idx_students_tutor_id on public.students(tutor_id);
create index if not exists idx_students_tutor_status on public.students(tutor_id, status);
create index if not exists idx_students_tutor_subject on public.students(tutor_id, subject);
create index if not exists idx_students_tutor_grade on public.students(tutor_id, grade);
create index if not exists idx_useful_links_student_order on public.useful_links(student_id, sort_order);
create index if not exists idx_lessons_student_date on public.lessons(student_id, lesson_date desc);
create index if not exists idx_lessons_student_status on public.lessons(student_id, homework_status);
create index if not exists idx_lesson_materials_lesson_order on public.lesson_materials(lesson_id, sort_order);
create index if not exists idx_homework_submissions_lesson_submitted on public.homework_submissions(lesson_id, submitted_at desc);
create index if not exists idx_homework_submissions_student_submitted on public.homework_submissions(student_id, submitted_at desc);
create index if not exists idx_homework_photos_submission_order on public.homework_submission_photos(submission_id, sort_order);
create index if not exists idx_update_events_student_seen_created on public.update_events(student_id, is_seen_by_student, created_at desc);
create index if not exists idx_update_events_lesson on public.update_events(lesson_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_tutors_updated_at') then
    create trigger set_tutors_updated_at
    before update on public.tutors
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_students_updated_at') then
    create trigger set_students_updated_at
    before update on public.students
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_useful_links_updated_at') then
    create trigger set_useful_links_updated_at
    before update on public.useful_links
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_lessons_updated_at') then
    create trigger set_lessons_updated_at
    before update on public.lessons
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_lesson_materials_updated_at') then
    create trigger set_lesson_materials_updated_at
    before update on public.lesson_materials
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.tutors enable row level security;
alter table public.students enable row level security;
alter table public.useful_links enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.homework_submission_photos enable row level security;
alter table public.update_events enable row level security;

create or replace function public.current_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.tutors t
  where t.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.tutor_owns_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.tutor_id = public.current_tutor_id()
  )
$$;

create or replace function public.tutor_owns_lesson(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.students s on s.id = l.student_id
    where l.id = target_lesson_id
      and s.tutor_id = public.current_tutor_id()
  )
$$;

create or replace function public.tutor_owns_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.homework_submissions hs
    join public.students s on s.id = hs.student_id
    where hs.id = target_submission_id
      and s.tutor_id = public.current_tutor_id()
  )
$$;

-- Student public access by token must be implemented via RPC/Edge Function.
-- Direct broad anon policies are intentionally not created in this MVP migration.

drop policy if exists "Tutors can select own profile" on public.tutors;
create policy "Tutors can select own profile"
on public.tutors
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "Tutors can insert own profile" on public.tutors;
create policy "Tutors can insert own profile"
on public.tutors
for insert
to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists "Tutors can update own profile" on public.tutors;
create policy "Tutors can update own profile"
on public.tutors
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "Tutors can select own students" on public.students;
create policy "Tutors can select own students"
on public.students
for select
to authenticated
using (tutor_id = public.current_tutor_id());

drop policy if exists "Tutors can insert own students" on public.students;
create policy "Tutors can insert own students"
on public.students
for insert
to authenticated
with check (tutor_id = public.current_tutor_id());

drop policy if exists "Tutors can update own students" on public.students;
create policy "Tutors can update own students"
on public.students
for update
to authenticated
using (tutor_id = public.current_tutor_id())
with check (tutor_id = public.current_tutor_id());

drop policy if exists "Tutors can select own useful links" on public.useful_links;
create policy "Tutors can select own useful links"
on public.useful_links
for select
to authenticated
using (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can insert own useful links" on public.useful_links;
create policy "Tutors can insert own useful links"
on public.useful_links
for insert
to authenticated
with check (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can update own useful links" on public.useful_links;
create policy "Tutors can update own useful links"
on public.useful_links
for update
to authenticated
using (public.tutor_owns_student(student_id))
with check (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can delete own useful links" on public.useful_links;
create policy "Tutors can delete own useful links"
on public.useful_links
for delete
to authenticated
using (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can select own lessons" on public.lessons;
create policy "Tutors can select own lessons"
on public.lessons
for select
to authenticated
using (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can insert own lessons" on public.lessons;
create policy "Tutors can insert own lessons"
on public.lessons
for insert
to authenticated
with check (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can update own lessons" on public.lessons;
create policy "Tutors can update own lessons"
on public.lessons
for update
to authenticated
using (public.tutor_owns_student(student_id))
with check (public.tutor_owns_student(student_id));

-- Lessons are soft-deleted via lessons.deleted_at in the MVP.
-- Do not expose physical DELETE to tutor clients.

drop policy if exists "Tutors can select own lesson materials" on public.lesson_materials;
create policy "Tutors can select own lesson materials"
on public.lesson_materials
for select
to authenticated
using (public.tutor_owns_lesson(lesson_id));

drop policy if exists "Tutors can insert own lesson materials" on public.lesson_materials;
create policy "Tutors can insert own lesson materials"
on public.lesson_materials
for insert
to authenticated
with check (public.tutor_owns_lesson(lesson_id));

drop policy if exists "Tutors can update own lesson materials" on public.lesson_materials;
create policy "Tutors can update own lesson materials"
on public.lesson_materials
for update
to authenticated
using (public.tutor_owns_lesson(lesson_id))
with check (public.tutor_owns_lesson(lesson_id));

drop policy if exists "Tutors can delete own lesson materials" on public.lesson_materials;
create policy "Tutors can delete own lesson materials"
on public.lesson_materials
for delete
to authenticated
using (public.tutor_owns_lesson(lesson_id));

drop policy if exists "Tutors can select own homework submissions" on public.homework_submissions;
create policy "Tutors can select own homework submissions"
on public.homework_submissions
for select
to authenticated
using (public.tutor_owns_student(student_id));

-- Homework submissions are created by the student token flow and reviewed via lessons.homework_status
-- and lessons.homework_review_comment. Tutor clients do not need to update submission rows directly.

drop policy if exists "Tutors can select own homework photos" on public.homework_submission_photos;
create policy "Tutors can select own homework photos"
on public.homework_submission_photos
for select
to authenticated
using (public.tutor_owns_submission(submission_id));

drop policy if exists "Tutors can select own update events" on public.update_events;
create policy "Tutors can select own update events"
on public.update_events
for select
to authenticated
using (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can insert own update events" on public.update_events;
create policy "Tutors can insert own update events"
on public.update_events
for insert
to authenticated
with check (public.tutor_owns_student(student_id));

drop policy if exists "Tutors can update own update events" on public.update_events;
create policy "Tutors can update own update events"
on public.update_events
for update
to authenticated
using (public.tutor_owns_student(student_id))
with check (public.tutor_owns_student(student_id));

-- Private bucket for homework photos. Supabase Storage metadata lives in the storage schema.
insert into storage.buckets (id, name, public)
values ('homework-photos', 'homework-photos', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Tutors can read own homework photo objects" on storage.objects;
create policy "Tutors can read own homework photo objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'homework-photos'
  and (storage.foldername(name))[1] = ('tutor_' || public.current_tutor_id()::text)
);

-- Student homework photo upload and read access should be handled by the same
-- secure token flow as public student profile access, via RPC/Edge Function.
-- Service role may bypass RLS inside trusted server-side code; never expose it to the browser.
