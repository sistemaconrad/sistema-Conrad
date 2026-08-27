-- SCRIPT: Comisión opcional en precio personalizado (justificado)
-- Ejecutar en Supabase > SQL Editor (base principal del sanatorio)
--
-- Antes: toda consulta con tipo_cobro = 'personalizado' (precio justificado)
-- quedaba automáticamente excluida de comisiones para el médico referente.
--
-- Ahora: al justificar un precio personalizado, el sistema pregunta si esa
-- consulta específica sí debe generar comisión. Esta columna guarda esa
-- respuesta (true = sí comisiona, false/null = no comisiona, igual que antes).

ALTER TABLE consultas ADD COLUMN IF NOT EXISTS comisiona_personalizado BOOLEAN;
