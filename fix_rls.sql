-- FIX PARA PERMITIR INSERCIONES DE USUARIOS AUTENTICADOS

-- Primero, borramos la política antigua de usuarios
DROP POLICY IF EXISTS "anon_all_usuarios" ON usuarios;

-- Y creamos la nueva política para TODO público (anon y authenticated)
CREATE POLICY "anon_all_usuarios" ON usuarios FOR ALL TO public USING (true) WITH CHECK (true);

-- Para evitar el mismo error en otras tablas si en algún momento se interactúa con ellas como usuario autenticado:
DROP POLICY IF EXISTS "anon_all_roles" ON roles;
CREATE POLICY "anon_all_roles" ON roles FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_rutas" ON rutas;
CREATE POLICY "anon_all_rutas" ON rutas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_clientes" ON clientes;
CREATE POLICY "anon_all_clientes" ON clientes FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_productos" ON productos;
CREATE POLICY "anon_all_productos" ON productos FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_creditos" ON creditos;
CREATE POLICY "anon_all_creditos" ON creditos FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_detalles_venta" ON detalles_venta;
CREATE POLICY "anon_all_detalles_venta" ON detalles_venta FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_cuotas" ON cuotas;
CREATE POLICY "anon_all_cuotas" ON cuotas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_recaudos" ON recaudos;
CREATE POLICY "anon_all_recaudos" ON recaudos FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_registro_visitas" ON registro_visitas;
CREATE POLICY "anon_all_registro_visitas" ON registro_visitas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_promesas_pago" ON promesas_pago;
CREATE POLICY "anon_all_promesas_pago" ON promesas_pago FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_configuracion_negocio" ON configuracion_negocio;
CREATE POLICY "anon_all_configuracion_negocio" ON configuracion_negocio FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_historial_alertas" ON historial_alertas;
CREATE POLICY "anon_all_historial_alertas" ON historial_alertas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_logs_auditoria" ON logs_auditoria;
CREATE POLICY "anon_all_logs_auditoria" ON logs_auditoria FOR ALL TO public USING (true) WITH CHECK (true);
