-- 1. Crear el bucket público para los documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos_clientes', 'documentos_clientes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir que cualquier usuario (autenticado o no, ideal para desarrollo) suba archivos
CREATE POLICY "Permitir subida de documentos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documentos_clientes');

-- 3. Permitir que cualquiera pueda ver y descargar las imágenes
CREATE POLICY "Permitir lectura de documentos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documentos_clientes');