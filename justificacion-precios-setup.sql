-- SCRIPT: Justificación de precios modificados manualmente
-- Ejecutar este script en el SQL Editor de Supabase (no modifica ni borra nada existente)
--
-- Agrega columnas nuevas a "detalle_consultas" para registrar cuándo un
-- secretario editó a mano el precio de un estudio (fuera de Personalizado)
-- y por qué, para que quede visible en Cuadre Diario, Cuadre Quincenal y Reportes.

ALTER TABLE detalle_consultas ADD COLUMN IF NOT EXISTS precio_modificado BOOLEAN DEFAULT FALSE;
ALTER TABLE detalle_consultas ADD COLUMN IF NOT EXISTS precio_original DECIMAL(10,2);
ALTER TABLE detalle_consultas ADD COLUMN IF NOT EXISTS justificacion_precio TEXT;
