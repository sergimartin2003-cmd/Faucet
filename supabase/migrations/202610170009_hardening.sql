-- Trigger functions are not meant to be called through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_profile_updated_at() from public, anon, authenticated;
revoke all on function public.reject_blocked_email_domains() from public, anon, authenticated;

-- Covering indexes for foreign keys.
create index if not exists survey_responses_survey_slug_idx on public.survey_responses (survey_slug);
create index if not exists survey_starts_survey_slug_idx on public.survey_starts (survey_slug);
create index if not exists trivia_answers_question_id_idx on public.trivia_answers (question_id);
create index if not exists video_starts_video_id_idx on public.video_starts (video_id);
create index if not exists video_views_video_id_idx on public.video_views (video_id);
