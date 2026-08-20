-- SCRIPT: Precio de Servicio Móvil por sub-estudio
-- Ejecutar este script en el SQL Editor de Supabase (no modifica ni borra nada existente)
--
-- Agrega dos columnas nuevas a la tabla "sub_estudios" que ya existe:
--  - disponible_movil: marca si ese sub-estudio puede usarse en Servicio Móvil
--  - precio_movil: precio propio para Servicio Móvil (independiente de
--    precio_normal / precio_social / precio_especial)
--
-- Se administran desde "Gestión de Productos" > editar un sub-estudio.

ALTER TABLE sub_estudios ADD COLUMN IF NOT EXISTS disponible_movil BOOLEAN DEFAULT FALSE;
ALTER TABLE sub_estudios ADD COLUMN IF NOT EXISTS precio_movil DECIMAL(10,2);
