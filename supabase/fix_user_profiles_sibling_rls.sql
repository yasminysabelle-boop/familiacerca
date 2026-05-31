-- Fix: miembros del mismo care_profile no se ven mutuamente en user_profiles
--
-- Diagnóstico:
--   La política "Profiles: visible to family group members" en user_profiles
--   solo cubría owner→member y member→owner, pero NO cubría sibling→sibling
--   (dos miembros del mismo care_profile). El JOIN en el USING expression
--   no funcionaba dentro del contexto de evaluación de otra política RLS
--   debido a recursión en family_members.
--
-- Solución:
--   Función SECURITY DEFINER que resuelve toda la lógica de visibilidad en
--   un solo contexto sin RLS, evitando el problema de self-join en políticas.

-- 1. Función que retorna todos los user_ids visibles para el usuario actual
CREATE OR REPLACE FUNCTION family_visible_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- (1) El propio usuario
  SELECT auth.uid()
  UNION
  -- (2) Miembros de familias que el usuario posee (es owner)
  SELECT member_user_id
  FROM family_members
  WHERE user_id = auth.uid()
    AND member_user_id IS NOT NULL
  UNION
  -- (3) Co-miembros (siblings) de familias a las que el usuario pertenece
  SELECT fm2.member_user_id
  FROM family_members fm1
  JOIN family_members fm2 ON fm1.user_id = fm2.user_id
  WHERE fm1.member_user_id = auth.uid()
    AND fm2.member_user_id IS NOT NULL
  UNION
  -- (4) Los owners de las familias en las que el usuario es miembro
  SELECT user_id
  FROM family_members
  WHERE member_user_id = auth.uid()
$$;

-- 2. Reemplazar la política SELECT de user_profiles con la nueva función
DROP POLICY IF EXISTS "Profiles: visible to family group members" ON user_profiles;

CREATE POLICY "Profiles: visible to family group members"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT family_visible_user_ids()));
