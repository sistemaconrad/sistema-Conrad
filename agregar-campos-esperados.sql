-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Agrega columnas de valores calculados a cuadres_diarios
-- ============================================================

ALTER TABLE cuadres_diarios
  ADD COLUMN IF NOT EXISTS efectivo_contado        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS efectivo_esperado        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarjeta_esperada          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferencia_esperada    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_cuenta_esperada    NUMERIC(10,2) DEFAULT 0;
