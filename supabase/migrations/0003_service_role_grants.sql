-- Grant trusted Edge Functions access to MVP tables.
-- service_role bypasses RLS, but still needs SQL privileges on tables/functions.

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.tutors to service_role;
grant select, insert, update, delete on table public.students to service_role;
grant select, insert, update, delete on table public.useful_links to service_role;
grant select, insert, update, delete on table public.lessons to service_role;
grant select, insert, update, delete on table public.lesson_materials to service_role;
grant select, insert, update, delete on table public.homework_submissions to service_role;
grant select, insert, update, delete on table public.homework_submission_photos to service_role;
grant select, insert, update, delete on table public.update_events to service_role;

grant execute on function public.current_tutor_id() to service_role;
grant execute on function public.tutor_owns_student(uuid) to service_role;
grant execute on function public.tutor_owns_lesson(uuid) to service_role;
grant execute on function public.tutor_owns_submission(uuid) to service_role;

