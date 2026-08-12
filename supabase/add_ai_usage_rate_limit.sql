-- ================================================================
-- FamiliaCerca — Rate limit de funciones de IA, por usuario/día y
-- por usuario/hora
-- ================================================================
-- Problema: gemini-proxy, gemini-vision y claude-proxy solo verifican
-- que exista una sesión válida -- sin plan, sin status, sin límite de
-- frecuencia. Crear una cuenta es gratis e instantáneo, así que
-- cualquiera puede consumir las API keys de Google/Anthropic (compartidas
-- por toda la app) sin tope. Exposición de costo directa.
--
-- Diseño: límite generoso para uso normal, solo para frenar abuso.
-- NUNCA depende del cliente -- se evalúa y se incrementa server-side,
-- atómico (INSERT ... ON CONFLICT ... RETURNING en una sola sentencia,
-- sin condición de carrera entre requests simultáneos del mismo
-- usuario). Mismo límite para todos los planes -- esto es protección
-- contra abuso, no un escalón de monetización (Milo es de todos los
-- planes). Único bypass: isAppAdmin (cuenta de administración de la
-- dueña del producto), chequeado en cada función antes de llamar al RPC.
--
-- Dos techos independientes, ambos deben cumplirse:
-- - Diario: cubre cómodo el uso real esperado (ver justificación por
--   función en la Edge Function correspondiente).
-- - Por hora: evita que alguien queme el cupo diario entero en minutos
--   -- un cuidador real no se acerca a este número ni en su peor día,
--   un script sí.
-- ================================================================

CREATE TABLE public.ai_usage_daily (
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  usage_date    date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  function_name text NOT NULL,          -- 'gemini-proxy' | 'gemini-vision' | 'claude-proxy'
  request_count int  NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date, function_name)
);

CREATE TABLE public.ai_usage_hourly (
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  usage_hour    timestamptz NOT NULL,   -- date_trunc('hour', now())
  function_name text NOT NULL,
  request_count int  NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_hour, function_name)
);

ALTER TABLE public.ai_usage_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_hourly ENABLE ROW LEVEL SECURITY;
-- Sin policies = sin acceso directo por API para nadie (ni anon ni
-- authenticated). Solo el RPC de abajo (SECURITY DEFINER) escribe/lee.
-- Consulta manual: vía Management API (supabase db query --linked),
-- no depende de RLS -- ej. para ver quién pegó el techo hoy:
--   select * from ai_usage_daily where request_count > <límite de esa función>
--     order by usage_date desc, request_count desc;

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_function_name text,
  p_daily_limit   int,
  p_hourly_limit  int
)
RETURNS boolean   -- true = permitido (ya incrementado en ambas tablas), false = algún techo alcanzado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_count  int;
  v_hourly_count int;
BEGIN
  -- Se incrementa siempre, incluso si termina bloqueado -- un intento
  -- bloqueado sigue siendo una señal real de abuso, útil para la
  -- consulta de arriba (un número muy por encima del límite delata
  -- reintentos después de ya estar bloqueado).
  INSERT INTO public.ai_usage_daily (user_id, usage_date, function_name, request_count)
  VALUES (auth.uid(), (now() AT TIME ZONE 'utc')::date, p_function_name, 1)
  ON CONFLICT (user_id, usage_date, function_name)
  DO UPDATE SET request_count = ai_usage_daily.request_count + 1, updated_at = now()
  RETURNING request_count INTO v_daily_count;

  INSERT INTO public.ai_usage_hourly (user_id, usage_hour, function_name, request_count)
  VALUES (auth.uid(), date_trunc('hour', now()), p_function_name, 1)
  ON CONFLICT (user_id, usage_hour, function_name)
  DO UPDATE SET request_count = ai_usage_hourly.request_count + 1, updated_at = now()
  RETURNING request_count INTO v_hourly_count;

  RETURN v_daily_count <= p_daily_limit AND v_hourly_count <= p_hourly_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(text, int, int) TO authenticated;

-- ----------------------------------------------------------------
-- Limpieza -- ai_usage_hourly acumula ~24 filas/usuario/función/día
-- sin este job. Mismo patrón que los cron jobs existentes
-- (setup_cron.sql), pero sin invocar ninguna Edge Function -- es SQL
-- puro, corre directo en el cron job.
-- ----------------------------------------------------------------
SELECT cron.schedule(
  'fc-ai-usage-cleanup',
  '0 3 * * *',  -- 3am UTC todos los días
  $$
    DELETE FROM public.ai_usage_hourly WHERE usage_hour  < now() - interval '2 days';
    DELETE FROM public.ai_usage_daily  WHERE usage_date  < (now() - interval '90 days')::date;
  $$
);
