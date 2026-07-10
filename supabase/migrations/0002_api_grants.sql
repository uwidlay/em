-- Grant browser roles access to the MVP tables.
-- RLS policies from 0001 still decide which rows are visible/mutable.

grant usage on schema public to anon, authenticated;

grant select, insert, update on table public.tutors to authenticated;

grant select, insert, update on table public.students to authenticated;

grant select, insert, update, delete on table public.useful_links to authenticated;

grant select, insert, update on table public.lessons to authenticated;

grant select, insert, update, delete on table public.lesson_materials to authenticated;

grant select on table public.homework_submissions to authenticated;
grant select on table public.homework_submission_photos to authenticated;

grant select, insert, update on table public.update_events to authenticated;

grant execute on function public.current_tutor_id() to authenticated;
grant execute on function public.tutor_owns_student(uuid) to authenticated;
grant execute on function public.tutor_owns_lesson(uuid) to authenticated;
grant execute on function public.tutor_owns_submission(uuid) to authenticated;

