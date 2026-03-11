-- ============================================================
-- TABLA: visitas_medicas
-- Ejecutar en Supabase > SQL Editor (base de datos de Visitadoras)
-- ============================================================

CREATE TABLE IF NOT EXISTS visitas_medicas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL,
  medico_nombre TEXT NOT NULL,
  medico_especialidad TEXT,
  visitadora_nombre TEXT NOT NULL,
  latitud DECIMAL(10, 7),
  longitud DECIMAL(10, 7),
  firma_receptor TEXT,         -- base64 de la imagen
  nombre_receptor TEXT,
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_visitas_medico_id ON visitas_medicas(medico_id);
CREATE INDEX IF NOT EXISTS idx_visitas_created_at ON visitas_medicas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_visitadora ON visitas_medicas(visitadora_nombre);

-- Habilitar RLS (Row Level Security)
ALTER TABLE visitas_medicas ENABLE ROW LEVEL SECURITY;

-- Política: todos los usuarios autenticados pueden ver y crear visitas
CREATE POLICY "Acceso completo a visitas_medicas" ON visitas_medicas
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TAMBIÉN: Agregar campo 'especialidad' y 'clinica' a la tabla
-- 'medicos' en la base principal si no existen
-- (ejecutar en Supabase principal - base del sanatorio)
-- ============================================================

ALTER TABLE medicos ADD COLUMN IF NOT EXISTS especialidad TEXT;
ALTER TABLE medicos ADD COLUMN IF NOT EXISTS clinica TEXT;
