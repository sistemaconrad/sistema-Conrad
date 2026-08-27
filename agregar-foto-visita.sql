-- SCRIPT: Foto obligatoria del lugar en Visitas Médicas
-- Ejecutar en Supabase > SQL Editor (base principal del sanatorio)
--
-- Agrega las columnas para guardar la foto del lugar (fuera del
-- establecimiento) que ahora es obligatoria al registrar una visita,
-- y crea el bucket de Storage donde se guardan esas fotos.

ALTER TABLE visitas_medicas ADD COLUMN IF NOT EXISTS foto_lugar_url TEXT;
ALTER TABLE visitas_medicas ADD COLUMN IF NOT EXISTS foto_lugar_path TEXT;

-- Bucket público "visitas" (público para poder mostrar las fotos con getPublicUrl,
-- igual que los buckets "perfiles" y "documentos" que ya usa el sistema)
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitas', 'visitas', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso al bucket (sin Auth de Supabase, igual de abierto que
-- el resto del sistema: "Acceso completo" en visitas_medicas)
DROP POLICY IF EXISTS "Lectura publica fotos visitas" ON storage.objects;
CREATE POLICY "Lectura publica fotos visitas" ON storage.objects
  FOR SELECT USING (bucket_id = 'visitas');

DROP POLICY IF EXISTS "Subida publica fotos visitas" ON storage.objects;
CREATE POLICY "Subida publica fotos visitas" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'visitas');

DROP POLICY IF EXISTS "Eliminacion publica fotos visitas" ON storage.objects;
CREATE POLICY "Eliminacion publica fotos visitas" ON storage.objects
  FOR DELETE USING (bucket_id = 'visitas');
