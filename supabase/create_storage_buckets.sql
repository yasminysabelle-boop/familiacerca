-- ================================================================
-- FamiliaCerca — Create all storage buckets
-- Run this in the Supabase SQL Editor
-- Drops existing policies first so it is safe to re-run
-- ================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('care-photos',         'care-photos',         true, 5242880,
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

-- ----------------------------------------------------------------
-- Drop existing policies (safe if they don't exist)
-- ----------------------------------------------------------------
drop policy if exists "care-photos: authenticated upload" on storage.objects;
drop policy if exists "care-photos: public read"          on storage.objects;
drop policy if exists "care-photos: owner update"         on storage.objects;
drop policy if exists "care-photos: owner delete"         on storage.objects;

-- legacy name, drop in case it exists from a previous run
drop policy if exists "profile-photos: authenticated upload" on storage.objects;
drop policy if exists "profile-photos: public read"          on storage.objects;
drop policy if exists "profile-photos: owner update"         on storage.objects;
drop policy if exists "profile-photos: owner delete"         on storage.objects;

drop policy if exists "appointment-proofs: authenticated upload" on storage.objects;
drop policy if exists "appointment-proofs: public read"          on storage.objects;
drop policy if exists "appointment-proofs: owner delete"         on storage.objects;

drop policy if exists "confirmations: authenticated upload" on storage.objects;
drop policy if exists "confirmations: public read"          on storage.objects;
drop policy if exists "confirmations: owner delete"         on storage.objects;

drop policy if exists "memories: authenticated upload" on storage.objects;
drop policy if exists "memories: public read"          on storage.objects;
drop policy if exists "memories: owner delete"         on storage.objects;

drop policy if exists "voice-diary: authenticated upload" on storage.objects;
drop policy if exists "voice-diary: public read"          on storage.objects;
drop policy if exists "voice-diary: owner delete"         on storage.objects;

-- ----------------------------------------------------------------
-- care-photos
-- ----------------------------------------------------------------
create policy "care-photos: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'care-photos' and auth.role() = 'authenticated');

create policy "care-photos: public read"
  on storage.objects for select
  using (bucket_id = 'care-photos');

create policy "care-photos: owner update"
  on storage.objects for update
  using (bucket_id = 'care-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "care-photos: owner delete"
  on storage.objects for delete
  using (bucket_id = 'care-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------
-- appointment-proofs
-- ----------------------------------------------------------------
create policy "appointment-proofs: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'appointment-proofs' and auth.role() = 'authenticated');

create policy "appointment-proofs: public read"
  on storage.objects for select
  using (bucket_id = 'appointment-proofs');

create policy "appointment-proofs: owner delete"
  on storage.objects for delete
  using (bucket_id = 'appointment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------
-- confirmations
-- ----------------------------------------------------------------
create policy "confirmations: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'confirmations' and auth.role() = 'authenticated');

create policy "confirmations: public read"
  on storage.objects for select
  using (bucket_id = 'confirmations');

create policy "confirmations: owner delete"
  on storage.objects for delete
  using (bucket_id = 'confirmations' and auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------
-- memories
-- ----------------------------------------------------------------
create policy "memories: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'memories' and auth.role() = 'authenticated');

create policy "memories: public read"
  on storage.objects for select
  using (bucket_id = 'memories');

create policy "memories: owner delete"
  on storage.objects for delete
  using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------
-- voice-diary
-- ----------------------------------------------------------------
create policy "voice-diary: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'voice-diary' and auth.role() = 'authenticated');

create policy "voice-diary: public read"
  on storage.objects for select
  using (bucket_id = 'voice-diary');

create policy "voice-diary: owner delete"
  on storage.objects for delete
  using (bucket_id = 'voice-diary' and auth.uid()::text = (storage.foldername(name))[1]);
