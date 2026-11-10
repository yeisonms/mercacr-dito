-- ====================================================================================
-- TABLA: devoluciones_productos
-- Registra el historial y la auditoría de cada producto devuelto al almacén,
-- el motivo, el estado físico y el destino del dinero pagado por el cliente.
-- ====================================================================================

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
    destino_dinero VARCHAR(50) NOT NULL, -- 'Abono_Otro_Credito', 'Devolucion_Efectivo', 'Saldo_Favor', 'Conservado_En_Compra'
    credito_destino_id UUID REFERENCES creditos(id) ON DELETE SET NULL,
    motivo TEXT NOT NULL,
    estado_fisico VARCHAR(50) DEFAULT 'Bueno', -- 'Bueno', 'Garantia_Proveedor'
    fecha_devolucion TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE devoluciones_productos ENABLE ROW LEVEL SECURITY;

-- Política de RLS permisiva para usuarios autenticados y anónimos en desarrollo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'devoluciones_productos' AND policyname = 'anon_all_devoluciones_productos'
  ) THEN
    CREATE POLICY "anon_all_devoluciones_productos" ON devoluciones_productos FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;
