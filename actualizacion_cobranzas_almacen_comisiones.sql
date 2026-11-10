-- ====================================================================================
-- MIGRACIÓN DE BASE DE DATOS: COBRANZA EN ALMACÉN Y CONTROL DE CUOTAS INICIALES
-- Para ejecutar en:
-- 1. Base de datos de Desarrollo/Pruebas (arlrofsypjgbplettmwp)
-- 2. Base de datos de Producción (al hacer merge de dev a main)
-- ====================================================================================

-- 1. Agregar columna origen_pago a la tabla recaudos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recaudos' AND column_name = 'origen_pago'
  ) THEN
    ALTER TABLE recaudos 
    ADD COLUMN origen_pago VARCHAR(30) DEFAULT 'Ruta';
  END IF;
END $$;

-- 2. Validar que la restricción CHECK exista para los valores permitidos ('Ruta', 'Almacen', 'CuotaInicial')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recaudos_origen_pago_check'
  ) THEN
    ALTER TABLE recaudos
    ADD CONSTRAINT recaudos_origen_pago_check 
    CHECK (origen_pago IN ('Ruta', 'Almacen', 'CuotaInicial'));
  END IF;
END $$;

-- 3. Permitir 'Devuelto' en el estado del recaudo si existe la restricción previa
DO $$
BEGIN
  ALTER TABLE recaudos DROP CONSTRAINT IF EXISTS recaudos_estado_check;
  ALTER TABLE recaudos 
  ADD CONSTRAINT recaudos_estado_check 
  CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado', 'Devuelto'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Clasificar retroactivamente los recaudos existentes:
-- Marcar como 'CuotaInicial' los que fueron generados automáticamente en ventas
UPDATE recaudos 
SET origen_pago = 'CuotaInicial'
WHERE observaciones ILIKE '%Abono Inicial%' 
   OR observaciones ILIKE '%Pago Automático al crear la venta%';

-- 5. Crear índices para optimizar las consultas de Cuadre de Caja y Comisiones
CREATE INDEX IF NOT EXISTS idx_recaudos_origen_pago ON recaudos(origen_pago);
CREATE INDEX IF NOT EXISTS idx_recaudos_cobrador_fecha ON recaudos(cobrador_id, fecha_recaudo, estado);
