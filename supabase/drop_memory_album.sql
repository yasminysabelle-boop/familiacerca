-- Elimina el feature "Álbum familiar" por completo (auditoría de simplificación, 2026-07-30).
-- Las 8 filas de `memories` eran todas de la cuenta de pruebas de la fundadora
-- (yasminysabellev@gmail.com) — cero adopción real, confirmado antes de borrar.
-- Sin foreign keys apuntando a `memories` (verificado contra information_schema).

begin;

-- 1) Limpia las entradas de "care_photo" en el timeline unificado (activity_log).
--    Son las tarjetas de "Fotos" que este mismo feature generaba vía trigger —
--    quedarían huérfanas (foto y ruta /album ya no existen) si se dejan.
delete from activity_log where type = 'care_photo';

-- 2) Trigger + función que poblaban activity_log en cada INSERT a memories.
--    El trigger se cae solo al hacer DROP TABLE (paso 6), pero la función es
--    un objeto aparte y hay que borrarla explícitamente.
drop function if exists public.trg_fn_memory() cascade;

-- 3) Políticas RLS del bucket de Storage (storage.objects es una tabla
--    compartida entre buckets, así que hay que apuntar a las políticas por nombre).
drop policy if exists "memories: authenticated upload" on storage.objects;
drop policy if exists "memories: public read"          on storage.objects;
drop policy if exists "memories: owner delete"          on storage.objects;

-- 4) Bucket y archivos: Postgres bloquea el DELETE directo sobre
--    storage.objects/storage.buckets (trigger storage.protect_delete(), evita
--    blobs huérfanos) — se borraron con la Storage API, no con SQL:
--    supabase storage rm --experimental -r ss:///memories --yes
--    (10 archivos + el bucket "memories", confirmado "Successfully deleted").

-- 5) La tabla. DROP TABLE se lleva de encajada el trigger trg_memory,
--    sus propias políticas RLS y cualquier índice — no hace falta borrarlos aparte.
drop table if exists public.memories;

commit;
