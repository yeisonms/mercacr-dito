# Guía de Migraciones de Base de Datos para Producción (Rama MAIN)

Este documento registra todas las modificaciones realizadas en la base de datos durante el desarrollo en la rama `dev`. Cuando se realice el merge hacia `main` (producción), estos scripts SQL deben ejecutarse en el **SQL Editor de Supabase del proyecto de Producción**.

---

## 1. Módulo de Devoluciones de Productos (`crear_tabla_devoluciones.sql`)
- **Propósito:** Permite registrar devoluciones totales o parciales de productos, reingresarlos al stock de inventario, descontar la deuda del crédito y redireccionar la cuota inicial o abonos (a otro crédito, conservar en la compra, o saldo a favor).
- **Archivo SQL:** [`crear_tabla_devoluciones.sql`](./crear_tabla_devoluciones.sql)
- **Instrucciones:** Ejecutar el contenido completo del archivo en el SQL Editor de Supabase Producción.

---

## 2. Diferenciación de Recaudos (Almacén vs Ruta vs Cuota Inicial) (`actualizacion_cobranzas_almacen_comisiones.sql`)
- **Propósito:** 
  1. **Evitar descuadres en el arqueo del cobrador:** Los abonos que los clientes pagan directamente en la caja del almacén/oficina no se le exigen en efectivo al cobrador al final del día.
  2. **Garantizar comisiones justas:** Los abonos en almacén sí le suman al porcentaje de comisión del cobrador asignado a esa ruta.
  3. **No pagar comisión de cobranza por la Cuota Inicial:** La cuota inicial pagada en la venta no genera comisión de cobro ni figura como efectivo que el cobrador deba entregar.
- **Archivo SQL:** [`actualizacion_cobranzas_almacen_comisiones.sql`](./actualizacion_cobranzas_almacen_comisiones.sql)
- **Instrucciones:** Ejecutar el contenido en el SQL Editor de Supabase Producción.

---

## Script Unificado de Producción

Para conveniencia, este es el script acumulado que se puede ejecutar de una sola vez en Producción:

```sql
-- ====================================================================================
-- SCRIPT UNIFICADO: DEVOLUCIONES + COBRANZAS ALMACÉN / CUOTA INICIAL
-- ====================================================================================

-- PARTE 1: TABLA DE DEVOLUCIONES
CREATE TABLE IF NOT EXISTS devoluciones_productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID REFERENCES creditos(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE RESTRICT,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_producto NUMERIC(12, 2) NOT NULL,
    subtotal_devuelto NUMERIC(12, 2) NOT NULL,
    monto_dinero_reconocido NUMERIC(12, 2) DEFAULT 0,
    destino_dinero VARCHAR(50) NOT NULL,
    credito_destino_id UUID REFERENCES creditos(id) ON DELETE SET NULL,
    motivo TEXT NOT NULL,
    estado_fisico VARCHAR(50) DEFAULT 'Bueno',
    fecha_devolucion TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE devoluciones_productos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'devoluciones_productos' AND policyname = 'anon_all_devoluciones_productos'
  ) THEN
    CREATE POLICY "anon_all_devoluciones_productos" ON devoluciones_productos FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- PARTE 2: DIFERENCIACIÓN DE ORIGEN DE RECAUDOS
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

DO $$
BEGIN
  ALTER TABLE recaudos DROP CONSTRAINT IF EXISTS recaudos_estado_check;
  ALTER TABLE recaudos 
  ADD CONSTRAINT recaudos_estado_check 
  CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado', 'Devuelto'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

UPDATE recaudos 
SET origen_pago = 'CuotaInicial'
WHERE observaciones ILIKE '%Abono Inicial%' 
   OR observaciones ILIKE '%Pago Automático al crear la venta%';

CREATE INDEX IF NOT EXISTS idx_recaudos_origen_pago ON recaudos(origen_pago);
CREATE INDEX IF NOT EXISTS idx_recaudos_cobrador_fecha ON recaudos(cobrador_id, fecha_recaudo, estado);
```
