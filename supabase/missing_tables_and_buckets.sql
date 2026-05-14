-- ================================================================
-- FamiliaCerca — Missing tables + storage buckets
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ================================================================


-- ================================================================
-- MISSING TABLE 1: family_members
-- ================================================================
create table if not exists public.family_members (
  id               uuid        primary key default gen_random_uuid(),
  care_profile_id  uuid        not null references public.care_profiles(id) on delete cascade,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  role             text        not null default 'caregiver'
                               check (role in ('primary', 'caregiver', 'viewer')),
  invited_by       uuid        references auth.users(id),
  joined_at        timestamptz not null default now(),
  unique (care_profile_id, user_id)
);

alter table public.family_members enable row level security;

create policy "Family members: select"
  on public.family_members for select using (auth.uid() = user_id);
create policy "Family members: all"
  on public.family_members for all using (auth.uid() = user_id);

create index if not exists idx_family_members_care on public.family_members(care_profile_id);
create index if not exists idx_family_members_user on public.family_members(user_id);


-- ================================================================
-- MISSING TABLE 2: medication_logs
-- ================================================================
create table if not exists public.medication_logs (
  id                  uuid        primary key default gen_random_uuid(),
  medication_id       uuid        not null references public.medications(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  log_date            date        not null default current_date,
  status              text        not null default 'pending'
                                  check (status in ('confirmed', 'missed', 'pending')),
  scheduled_time      time,
  confirmed_at        timestamptz,
  confirmed_by_name   text,
  photo_url           text,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (medication_id, log_date, user_id)
);

alter table public.medication_logs enable row level security;

create policy "Own medication logs: all"
  on public.medication_logs for all using (auth.uid() = user_id);

create index if not exists idx_medication_logs_user on public.medication_logs(user_id);
create index if not exists idx_medication_logs_date on public.medication_logs(log_date);
create index if not exists idx_medication_logs_med  on public.medication_logs(medication_id);

alter publication supabase_realtime add table public.medication_logs;


-- ================================================================
-- MISSING TABLE 3: appointment_proofs
-- ================================================================
create table if not exists public.appointment_proofs (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references public.events(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  photo_url  text,
  notes      text,
  attended   boolean     not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.appointment_proofs enable row level security;

create policy "Own appointment proofs: all"
  on public.appointment_proofs for all using (auth.uid() = user_id);

create index if not exists idx_appointment_proofs_event on public.appointment_proofs(event_id);


-- ================================================================
-- STORAGE BUCKETS (all 5 — safe to re-run via on conflict)
-- ================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos',     'profile-photos',     true, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('appointment-proofs', 'appointment-proofs', true, 10485760,
   array['image/jpeg','image/png','image/webp']),
  ('confirmations',      'confirmations',      true, 10485760,
   array['image/jpeg','image/png','image/webp']),
  ('memories',           'memories',           true, 52428800,
   array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
  ('voice-diary',        'voice-diary',        true, 52428800,
   array['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do nothing;

-- profile-photos
create policy "profile-photos: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'profile-photos' and auth.role() = 'authenticated');
create policy "profile-photos: public read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');
create policy "profile-photos: owner update"
  on storage.objects for update
  using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "profile-photos: owner delete"
  on storage.objects for delete
  using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- appointment-proofs
create policy "appointment-proofs: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'appointment-proofs' and auth.role() = 'authenticated');
create policy "appointment-proofs: public read"
  on storage.objects for select
  using (bucket_id = 'appointment-proofs');
create policy "appointment-proofs: owner delete"
  on storage.objects for delete
  using (bucket_id = 'appointment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

-- confirmations
create policy "confirmations: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'confirmations' and auth.role() = 'authenticated');
create policy "confirmations: public read"
  on storage.objects for select
  using (bucket_id = 'confirmations');
create policy "confirmations: owner delete"
  on storage.objects for delete
  using (bucket_id = 'confirmations' and auth.uid()::text = (storage.foldername(name))[1]);

-- memories
create policy "memories: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'memories' and auth.role() = 'authenticated');
create policy "memories: public read"
  on storage.objects for select
  using (bucket_id = 'memories');
create policy "memories: owner delete"
  on storage.objects for delete
  using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

-- voice-diary
create policy "voice-diary: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'voice-diary' and auth.role() = 'authenticated');
create policy "voice-diary: public read"
  on storage.objects for select
  using (bucket_id = 'voice-diary');
create policy "voice-diary: owner delete"
  on storage.objects for delete
  using (bucket_id = 'voice-diary' and auth.uid()::text = (storage.foldername(name))[1]);
