-- Private files attached by tutors to lesson materials / homework instructions.
-- The lesson_materials.url value stores paths as lesson-file://<storage_path>.

insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Tutors can read own lesson file objects" on storage.objects;
create policy "Tutors can read own lesson file objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lesson-files'
  and (storage.foldername(name))[1] = ('tutor_' || public.current_tutor_id()::text)
);

drop policy if exists "Tutors can upload own lesson file objects" on storage.objects;
create policy "Tutors can upload own lesson file objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-files'
  and (storage.foldername(name))[1] = ('tutor_' || public.current_tutor_id()::text)
);

drop policy if exists "Tutors can update own lesson file objects" on storage.objects;
create policy "Tutors can update own lesson file objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-files'
  and (storage.foldername(name))[1] = ('tutor_' || public.current_tutor_id()::text)
)
with check (
  bucket_id = 'lesson-files'
  and (storage.foldername(name))[1] = ('tutor_' || public.current_tutor_id()::text)
);

drop policy if exists "Tutors can delete own lesson file objects" on storage.objects;
create policy "Tutors can delete own lesson file objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-files'
  and (storage.foldername(name))[1] = ('tutor_' || public.current_tutor_id()::text)
);
