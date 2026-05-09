-- Fix: agregar constraint UNIQUE en embeddings_faciales.empleado_id
-- para que el upsert con on_conflict='empleado_id' funcione.
--
-- Si ya existen filas duplicadas, mantenemos la más reciente.

-- Borrar duplicados manteniendo la fila más reciente por empleado
DELETE FROM embeddings_faciales
 WHERE id NOT IN (
   SELECT DISTINCT ON (empleado_id) id
     FROM embeddings_faciales
    ORDER BY empleado_id, creado_en DESC
 );

-- Constraint UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embeddings_faciales_empleado_id_unique'
  ) THEN
    ALTER TABLE embeddings_faciales
      ADD CONSTRAINT embeddings_faciales_empleado_id_unique UNIQUE (empleado_id);
  END IF;
END $$;
