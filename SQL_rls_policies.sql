-- ====================================================================================
-- POLÍTICAS RLS (Row Level Security) para Mercacrédito
-- Ejecuta este script en el SQL Editor de Supabase DESPUÉS del SQL inicial.
-- 
-- ⚠️  IMPORTANTE: Estas políticas abren acceso total para desarrollo.
--     En producción deberás restringirlas por usuario/rol.
-- ====================================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recaudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE promesas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;

-- ====================================================================================
-- POLÍTICAS DE ACCESO ABIERTO (solo para desarrollo / demo)
-- Permite SELECT, INSERT, UPDATE, DELETE a cualquier usuario anónimo.
-- ====================================================================================

-- roles
CREATE POLICY "anon_all_roles" ON roles FOR ALL TO anon USING (true) WITH CHECK (true);

-- usuarios
CREATE POLICY "anon_all_usuarios" ON usuarios FOR ALL TO anon USING (true) WITH CHECK (true);

-- rutas
CREATE POLICY "anon_all_rutas" ON rutas FOR ALL TO anon USING (true) WITH CHECK (true);

-- clientes
CREATE POLICY "anon_all_clientes" ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);

-- productos
CREATE POLICY "anon_all_productos" ON productos FOR ALL TO anon USING (true) WITH CHECK (true);

-- creditos
CREATE POLICY "anon_all_creditos" ON creditos FOR ALL TO anon USING (true) WITH CHECK (true);

-- detalles_venta
CREATE POLICY "anon_all_detalles_venta" ON detalles_venta FOR ALL TO anon USING (true) WITH CHECK (true);

-- cuotas
CREATE POLICY "anon_all_cuotas" ON cuotas FOR ALL TO anon USING (true) WITH CHECK (true);

-- recaudos
CREATE POLICY "anon_all_recaudos" ON recaudos FOR ALL TO anon USING (true) WITH CHECK (true);

-- registro_visitas
CREATE POLICY "anon_all_registro_visitas" ON registro_visitas FOR ALL TO anon USING (true) WITH CHECK (true);

-- promesas_pago
CREATE POLICY "anon_all_promesas_pago" ON promesas_pago FOR ALL TO anon USING (true) WITH CHECK (true);

-- configuracion_negocio
CREATE POLICY "anon_all_configuracion_negocio" ON configuracion_negocio FOR ALL TO anon USING (true) WITH CHECK (true);

-- historial_alertas
CREATE POLICY "anon_all_historial_alertas" ON historial_alertas FOR ALL TO anon USING (true) WITH CHECK (true);

-- logs_auditoria
CREATE POLICY "anon_all_logs_auditoria" ON logs_auditoria FOR ALL TO anon USING (true) WITH CHECK (true);

-- ====================================================================================
-- DATOS DE PRUEBA: Rutas iniciales
-- (Necesarias para que el formulario de Nuevo Cliente cargue opciones)
-- ====================================================================================

INSERT INTO rutas (codigo_ruta, nombre_ruta, estado) VALUES
('R-001', 'Norte', 'Activa'),
('R-002', 'Sur', 'Activa'),
('R-003', 'Centro', 'Activa'),
('R-004', 'Occidente', 'Activa'),
('R-005', 'Oriente', 'Activa')
ON CONFLICT (codigo_ruta) DO NOTHING;
