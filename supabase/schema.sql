-- ================================================================
-- FamiliaCerca — Complete Supabase Schema
-- Run this entire file in the Supabase SQL Editor
--
-- Table name mapping (code name → prompt name):
--   events            → calendar_events
--   medication_logs   → medication_confirmations
--   memories          → photo_album
-- ================================================================


-- ================================================================
-- 1. USER PROFILES
-- Mirrors auth.users; auto-created on signup via trigger.
-- ================================================================
create table if not exists public.user_profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ================================================================
-- 2. CARE PROFILES
-- One per user — the elderly person being cared for.
-- Unique on user_id so upsert({ onConflict: 'user_id' }) works.
-- ================================================================
create table if not exists public.care_profiles (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  age            int,
  medical_notes  text,
  photo_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id)
);


-- ================================================================
-- 3. FAMILY MEMBERS
-- Links additional caregivers to a care profile.
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


-- ================================================================
-- 4. MEDICATIONS
-- ================================================================
create table if not exists public.medications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  dosage      text,
  frequency   text,
  time        time,
  notes       text,
  created_at  timestamptz not null default now()
);


-- ================================================================
-- 5. MEDICATION LOGS  (= medication_confirmations)
-- One row per medication per day per user.
-- Unique on (medication_id, log_date, user_id) for upsert.
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


-- ================================================================
-- 6. EVENTS  (= calendar_events)
-- ================================================================
create table if not exists public.events (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  title        text        not null,
  date         date        not null,
  time         time,
  description  text,
  type         text        not null default 'appointment'
                           check (type in ('appointment', 'medication', 'therapy', 'other')),
  created_at   timestamptz not null default now()
);


-- ================================================================
-- 7. APPOINTMENT PROOFS
-- Photo evidence that a calendar appointment was attended.
-- Unique on (event_id, user_id) for upsert.
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


-- ================================================================
-- 8. NOTES
-- ================================================================
create table if not exists public.notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text,
  content     text,
  tags        text[]      not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ================================================================
-- 9. CHAT MESSAGES
-- Family-wide shared chat — all authenticated users can read.
-- ================================================================
create table if not exists public.chat_messages (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  user_name   text,
  message     text        not null,
  owner_id    uuid        references auth.users(id),
  created_at  timestamptz not null default now()
);


-- ================================================================
-- 10. VOICE DIARY
-- ================================================================
create table if not exists public.voice_diary (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  title            text,
  audio_url        text        not null,
  duration_seconds int,
  created_at       timestamptz not null default now()
);


-- ================================================================
-- 11. MEMORIES  (= photo_album)
-- Shared family photo/video album.
-- ================================================================
create table if not exists public.memories (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  uploader_name  text,
  file_url       text        not null,
  file_type      text        not null default 'image'
                             check (file_type in ('image', 'video')),
  caption        text,
  reactions      jsonb       not null default '{}',
  created_at     timestamptz not null default now()
);


-- ================================================================
-- INDEXES
-- ================================================================
create index if not exists idx_care_profiles_user         on public.care_profiles(user_id);
create index if not exists idx_family_members_care        on public.family_members(care_profile_id);
create index if not exists idx_family_members_user        on public.family_members(user_id);
create index if not exists idx_medications_user           on public.medications(user_id);
create index if not exists idx_medication_logs_user       on public.medication_logs(user_id);
create index if not exists idx_medication_logs_date       on public.medication_logs(log_date);
create index if not exists idx_medication_logs_med        on public.medication_logs(medication_id);
create index if not exists idx_events_user                on public.events(user_id);
create index if not exists idx_events_date                on public.events(date);
create index if not exists idx_appointment_proofs_event   on public.appointment_proofs(event_id);
create index if not exists idx_notes_user                 on public.notes(user_id);
create index if not exists idx_notes_created              on public.notes(created_at desc);
create index if not exists idx_chat_messages_created      on public.chat_messages(created_at asc);
create index if not exists idx_voice_diary_user           on public.voice_diary(user_id);
create index if not exists idx_memories_user              on public.memories(user_id);
create index if not exists idx_memories_created           on public.memories(created_at desc);


-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
alter table public.user_profiles       enable row level security;
alter table public.care_profiles       enable row level security;
alter table public.family_members      enable row level security;
alter table public.medications         enable row level security;
alter table public.medication_logs     enable row level security;
alter table public.events              enable row level security;
alter table public.appointment_proofs  enable row level security;
alter table public.notes               enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.voice_diary         enable row level security;
alter table public.memories            enable row level security;

-- user_profiles
create policy "Own profile: select"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Own profile: update"
  on public.user_profiles for update using (auth.uid() = id);

-- care_profiles
create policy "Own care profile: all"
  on public.care_profiles for all using (auth.uid() = user_id);

-- family_members
create policy "Family members: select"
  on public.family_members for select using (auth.uid() = user_id);
create policy "Family members: all"
  on public.family_members for all using (auth.uid() = user_id);

-- medications
create policy "Own medications: all"
  on public.medications for all using (auth.uid() = user_id);

-- medication_logs
create policy "Own medication logs: all"
  on public.medication_logs for all using (auth.uid() = user_id);

-- events
create policy "Own events: all"
  on public.events for all using (auth.uid() = user_id);

-- appointment_proofs
create policy "Own appointment proofs: all"
  on public.appointment_proofs for all using (auth.uid() = user_id);

-- notes
create policy "Own notes: all"
  on public.notes for all using (auth.uid() = user_id);

-- chat_messages: all authenticated users share one family chat
create policy "Chat: authenticated can read"
  on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "Chat: authenticated can insert"
  on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "Chat: own messages can delete"
  on public.chat_messages for delete using (auth.uid() = user_id);

-- voice_diary
create policy "Own voice diary: all"
  on public.voice_diary for all using (auth.uid() = user_id);

-- memories: shared album — all authenticated users can read & react
create policy "Memories: authenticated can read"
  on public.memories for select using (auth.role() = 'authenticated');
create policy "Memories: authenticated can insert"
  on public.memories for insert with check (auth.uid() = user_id);
create policy "Memories: own can update (reactions)"
  on public.memories for update using (auth.uid() = user_id);
create policy "Memories: own can delete"
  on public.memories for delete using (auth.uid() = user_id);


-- ================================================================
-- REALTIME
-- ================================================================
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.medication_logs;
alter publication supabase_realtime add table public.memories;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.notes;


-- ================================================================
-- STORAGE BUCKETS
-- All buckets are public so URLs returned by getPublicUrl() work
-- without additional auth headers.
-- ================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos',     'profile-photos',     true, 5242880,   array['image/jpeg','image/png','image/webp']),
  ('appointment-proofs', 'appointment-proofs', true, 10485760,  array['image/jpeg','image/png','image/webp']),
  ('confirmations',      'confirmations',      true, 10485760,  array['image/jpeg','image/png','image/webp']),
  ('memories',           'memories',           true, 52428800,  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
  ('voice-diary',        'voice-diary',        true, 52428800,  array['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do nothing;

-- profile-photos policies
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

-- appointment-proofs policies
create policy "appointment-proofs: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'appointment-proofs' and auth.role() = 'authenticated');
create policy "appointment-proofs: public read"
  on storage.objects for select
  using (bucket_id = 'appointment-proofs');
create policy "appointment-proofs: owner delete"
  on storage.objects for delete
  using (bucket_id = 'appointment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

-- confirmations policies
create policy "confirmations: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'confirmations' and auth.role() = 'authenticated');
create policy "confirmations: public read"
  on storage.objects for select
  using (bucket_id = 'confirmations');
create policy "confirmations: owner delete"
  on storage.objects for delete
  using (bucket_id = 'confirmations' and auth.uid()::text = (storage.foldername(name))[1]);

-- memories policies
create policy "memories: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'memories' and auth.role() = 'authenticated');
create policy "memories: public read"
  on storage.objects for select
  using (bucket_id = 'memories');
create policy "memories: owner delete"
  on storage.objects for delete
  using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

-- voice-diary policies
create policy "voice-diary: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'voice-diary' and auth.role() = 'authenticated');
create policy "voice-diary: public read"
  on storage.objects for select
  using (bucket_id = 'voice-diary');
create policy "voice-diary: owner delete"
  on storage.objects for delete
  using (bucket_id = 'voice-diary' and auth.uid()::text = (storage.foldername(name))[1]);
