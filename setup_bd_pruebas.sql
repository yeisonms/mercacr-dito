-- ====================================================================================
-- SCRIPT DE INICIALIZACIÓN COMPLETA PARA BASE DE DATOS DE PRUEBAS / STAGING
-- Mercacrédito ERP (Proyecto: arlrofsypjgbplettmwp)
-- ====================================================================================

-- 1. Habilitar extensión UUID y criptográfica
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Limpieza previa de tablas públicas
DROP TABLE IF EXISTS logs_auditoria CASCADE;
DROP TABLE IF EXISTS historial_alertas CASCADE;
DROP TABLE IF EXISTS configuracion_negocio CASCADE;
DROP TABLE IF EXISTS promesas_pago CASCADE;
DROP TABLE IF EXISTS registro_visitas CASCADE;
DROP TABLE IF EXISTS devoluciones_productos CASCADE;
DROP TABLE IF EXISTS recaudos CASCADE;
DROP TABLE IF EXISTS cuotas CASCADE;
DROP TABLE IF EXISTS detalles_venta CASCADE;
DROP TABLE IF EXISTS creditos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS rutas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ====================================================================================
-- TABLAS PRINCIPALES
-- ====================================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) UNIQUE NOT NULL CHECK (nombre_rol IN ('Administrador', 'Gerencia', 'Cobrador', 'Vendedor', 'Auxiliar')),
    descripcion TEXT
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT 'managed_by_supabase_auth',
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    porcentaje_ventas NUMERIC(5, 2) DEFAULT 0,
    porcentaje_cobranza NUMERIC(5, 2) DEFAULT 0
);

CREATE TABLE rutas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_ruta VARCHAR(10) UNIQUE NOT NULL,
    nombre_ruta VARCHAR(100) NOT NULL,
    cobrador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    dias_visita JSONB,
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Inactiva')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruta_id UUID REFERENCES rutas(id) ON DELETE RESTRICT,
    codigo_consecutivo VARCHAR(20) UNIQUE NOT NULL,
    secuencia_visita INT NOT NULL DEFAULT 1,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cedula VARCHAR(20),
    telefono_principal VARCHAR(20) NOT NULL,
    telefono_alterno VARCHAR(20),
    direccion VARCHAR(150) NOT NULL,
    barrio VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL DEFAULT 'Popayán',
    lugar_trabajo VARCHAR(150),
    telefono_trabajo VARCHAR(20),
    referencias_familiares JSONB,
    referencias_personales JSONB,
    foto_cliente_url VARCHAR(255),
    foto_cedula_frente_url VARCHAR(255),
    foto_cedula_respaldo_url VARCHAR(255),
    foto_casa_1_url VARCHAR(255),
    foto_casa_2_url VARCHAR(255),
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    observaciones TEXT,
    numero_cartera VARCHAR(50),
    bloqueado BOOLEAN DEFAULT FALSE,
    motivo_bloqueo VARCHAR(255),
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo', 'Moroso', 'Judicial', 'Finalizado')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_producto VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    precio_compra NUMERIC(12, 2) DEFAULT 0,
    precio_contado NUMERIC(12, 2) NOT NULL,
    precio_credito NUMERIC(12, 2) NOT NULL,
    stock_disponible INT DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Descontinuado')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE creditos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT,
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    fecha_venta TIMESTAMPTZ DEFAULT NOW(),
    tipo_venta VARCHAR(30) NOT NULL CHECK (tipo_venta IN ('Contado', 'Credito', 'Credicontado', 'Credicontado 3 Meses', 'Manual', 'Migracion')),
    valor_contado NUMERIC(12, 2) NOT NULL,
    valor_credito NUMERIC(12, 2) NOT NULL,
    cuota_inicial NUMERIC(12, 2) DEFAULT 0,
    saldo_pendiente NUMERIC(12, 2) NOT NULL,
    numero_cuotas INT DEFAULT 0,
    valor_cuota NUMERIC(12, 2) DEFAULT 0,
    frecuencia_pago VARCHAR(20) CHECK (frecuencia_pago IN ('Semanal', 'Quincenal', 'Mensual', 'Única', 'Decenal')),
    fecha_proximo_pago DATE,
    fecha_final_estimada DATE,
    fecha_limite_credicontado DATE,
    saldo_contado NUMERIC(12, 2),
    penalidad_aplicada BOOLEAN DEFAULT FALSE,
    fecha_penalidad DATE,
    metodo_pago VARCHAR(30) DEFAULT 'Efectivo',
    fecha_primer_pago DATE,
    motivo_devolucion TEXT,
    fecha_devolucion TIMESTAMPTZ,
    estado VARCHAR(30) DEFAULT 'Al día' CHECK (estado IN ('Al día', 'Próximo a vencer', 'Atrasado', 'En mora', 'Cancelado', 'Finalizado', 'Devuelto'))
);

CREATE TABLE detalles_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID REFERENCES creditos(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL,
    precio_aplicado NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
);

CREATE TABLE cuotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID REFERENCES creditos(id) ON DELETE CASCADE,
    numero_cuota INT NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    valor_cuota NUMERIC(12, 2) NOT NULL,
    valor_pagado NUMERIC(12, 2) DEFAULT 0,
    saldo_cuota NUMERIC(12, 2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Parcial', 'Pagada', 'En Mora', 'Devuelto'))
);

CREATE TABLE recaudos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID REFERENCES creditos(id) ON DELETE RESTRICT,
    cobrador_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    revisado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    valor_recibido NUMERIC(12, 2) NOT NULL,
    fecha_recaudo TIMESTAMPTZ DEFAULT NOW(),
    soporte_foto_dinero_url VARCHAR(255),
    soporte_comprobante_url VARCHAR(255),
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado', 'Devuelto')),
    fecha_revision TIMESTAMPTZ,
    metodo_pago VARCHAR(30) DEFAULT 'Efectivo',
    origen_pago VARCHAR(30) DEFAULT 'Ruta' CHECK (origen_pago IN ('Ruta', 'Almacen', 'CuotaInicial'))
);

CREATE TABLE registro_visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    cobrador_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    recaudo_id UUID REFERENCES recaudos(id) ON DELETE SET NULL,
    fecha_visita DATE DEFAULT CURRENT_DATE,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    estado VARCHAR(30) NOT NULL DEFAULT 'Visitado con Pago',
    estado_gestion VARCHAR(30) DEFAULT 'Visitado con Pago',
    hora_gestion TIMESTAMPTZ,
    observaciones TEXT
);

CREATE TABLE promesas_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_visita_id UUID REFERENCES registro_visitas(id) ON DELETE CASCADE,
    fecha_compromiso DATE NOT NULL,
    valor_prometido NUMERIC(12, 2),
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Cumplida', 'Incumplida'))
);

CREATE TABLE configuracion_negocio (
    id SERIAL PRIMARY KEY,
    porcentaje_mora_mes_3 NUMERIC(5, 2) NOT NULL,
    dias_gracia_mora INT DEFAULT 0,
    plantilla_recordatorio_antici TEXT,
    plantilla_mora_critica TEXT,
    ultima_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE historial_alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    credito_id UUID REFERENCES creditos(id) ON DELETE CASCADE,
    tipo_medio VARCHAR(20) NOT NULL CHECK (tipo_medio IN ('WhatsApp', 'SMS')),
    tipo_disparador VARCHAR(50) NOT NULL,
    mensaje_enviado TEXT NOT NULL,
    estado_envio VARCHAR(30) DEFAULT 'Pendiente',
    fecha_envio TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE logs_auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_hora TIMESTAMPTZ DEFAULT NOW(),
    accion VARCHAR(50) NOT NULL,
    tabla_afectada VARCHAR(50) NOT NULL,
    registro_id VARCHAR(50) NOT NULL,
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    direccion_ip VARCHAR(50)
);

CREATE TABLE devoluciones_productos (
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

-- ====================================================================================
-- POLÍTICAS DE SEGURIDAD RLS (ACCESO TOTAL PERMITIDO)
-- ====================================================================================

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
ALTER TABLE devoluciones_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_roles" ON roles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_usuarios" ON usuarios FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_rutas" ON rutas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_clientes" ON clientes FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_productos" ON productos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_creditos" ON creditos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_detalles_venta" ON detalles_venta FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cuotas" ON cuotas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_recaudos" ON recaudos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_registro_visitas" ON registro_visitas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_promesas_pago" ON promesas_pago FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_configuracion_negocio" ON configuracion_negocio FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_historial_alertas" ON historial_alertas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_logs_auditoria" ON logs_auditoria FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_devoluciones_productos" ON devoluciones_productos FOR ALL TO public USING (true) WITH CHECK (true);

-- ====================================================================================
-- DATOS SEMILLA BÁSICOS (ROLES Y CONFIGURACIÓN)
-- ====================================================================================

INSERT INTO roles (id, nombre_rol, descripcion) VALUES 
(1, 'Administrador', 'Control total del sistema y aprobaciones'),
(2, 'Gerencia', 'Visualización general y auditoría'),
(3, 'Cobrador', 'Gestión de campo y recaudo móvil'),
(4, 'Vendedor', 'Generación de créditos y ventas de contado'),
(5, 'Auxiliar', 'Gestión operativa limitada')
ON CONFLICT (id) DO NOTHING;

INSERT INTO configuracion_negocio (porcentaje_mora_mes_3, dias_gracia_mora, plantilla_recordatorio_antici, plantilla_mora_critica)
VALUES (5.00, 2, 'Hola, recuerda que mañana vence tu cuota con Mercacrédito.', 'Aviso urgente: Tu crédito presenta un atraso superior a 30 días.');

-- ====================================================================================
-- USUARIOS DE AUTENTICACIÓN (LOGIN DIRECTO)
-- Email: admin@mercacredito.com | Contraseña: Admin123*
-- ====================================================================================

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '52709375-28fd-4129-af98-8bc7e0536025',
    'authenticated',
    'authenticated',
    'admin@mercacredito.com',
    crypt('Admin123*', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre_completo":"Jeffer Toro (Admin Pruebas)"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    '52709375-28fd-4129-af98-8bc7e0536025',
    '52709375-28fd-4129-af98-8bc7e0536025',
    'admin@mercacredito.com',
    json_build_object('sub', '52709375-28fd-4129-af98-8bc7e0536025', 'email', 'admin@mercacredito.com'),
    'email',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Usuario en tabla pública vinculado al Auth
INSERT INTO usuarios (id, rol_id, nombre_completo, email, estado, porcentaje_ventas, porcentaje_cobranza)
VALUES 
('52709375-28fd-4129-af98-8bc7e0536025', 1, 'Jeffer Toro (Admin Pruebas)', 'admin@mercacredito.com', 'Activo', 5.0, 5.0),
('ec218327-a629-4df8-b957-f88a4a740b8a', 3, 'Sebastian Cobrador (Pruebas)', 'sebas@mercacredito.com', 'Activo', 0.0, 8.0)
ON CONFLICT (id) DO NOTHING;

-- Ruta de prueba
INSERT INTO rutas (id, codigo_ruta, nombre_ruta, cobrador_id, dias_visita, estado)
VALUES ('7b102b3c-5353-4882-965a-074092bdf675', 'RUTA-01', 'Ruta Popayán Norte (Pruebas)', 'ec218327-a629-4df8-b957-f88a4a740b8a', '["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]', 'Activa')
ON CONFLICT (id) DO NOTHING;

-- Cliente de prueba
INSERT INTO clientes (id, ruta_id, codigo_consecutivo, secuencia_visita, nombres, apellidos, cedula, telefono_principal, direccion, barrio, ciudad, numero_cartera, estado)
VALUES ('2e215e23-a681-404b-98e6-fcb766b1d057', '7b102b3c-5353-4882-965a-074092bdf675', 'CLI-00354', 1, 'ACK CHAYA', 'RENGIFO GUARIN', '1061800001', '3135719693', 'Barrio La Paz', 'LA PAZ', 'Popayán', '15', 'Activo')
ON CONFLICT (id) DO NOTHING;

-- Crédito de prueba (para probar el caso de los $200.000 vs $20.000)
INSERT INTO creditos (id, cliente_id, vendedor_id, numero_factura, tipo_venta, valor_contado, valor_credito, cuota_inicial, saldo_pendiente, saldo_contado, numero_cuotas, valor_cuota, frecuencia_pago, fecha_proximo_pago, fecha_final_estimada, fecha_limite_credicontado, estado)
VALUES ('ec146663-960a-4810-9682-4e57f2a3efa8', '2e215e23-a681-404b-98e6-fcb766b1d057', '52709375-28fd-4129-af98-8bc7e0536025', 'FAC-4599', 'Credicontado', 1535000, 2195000, 0, 1995000, 1335000, 2, 768000, 'Mensual', '2026-10-30', '2026-11-29', '2026-11-29', 'Al día')
ON CONFLICT (id) DO NOTHING;

-- Cuotas de prueba
INSERT INTO cuotas (id, credito_id, numero_cuota, fecha_vencimiento, valor_cuota, valor_pagado, saldo_cuota, estado)
VALUES 
('26d532d5-9d85-4303-8bd0-51e9b3f06ecb', 'ec146663-960a-4810-9682-4e57f2a3efa8', 1, '2026-10-30', 768000, 200000, 568000, 'Parcial'),
('80017288-7b3d-479a-9694-52359fbdf9e5', 'ec146663-960a-4810-9682-4e57f2a3efa8', 2, '2026-11-30', 767000, 0, 767000, 'Pendiente')
ON CONFLICT (id) DO NOTHING;

-- Recaudo de prueba de $200.000 para editar
INSERT INTO recaudos (id, credito_id, cobrador_id, valor_recibido, fecha_recaudo, estado, fecha_revision, metodo_pago)
VALUES ('baed9e54-3113-434b-821f-3ce01916d71d', 'ec146663-960a-4810-9682-4e57f2a3efa8', 'ec218327-a629-4df8-b957-f88a4a740b8a', 200000, NOW() - INTERVAL '2 hours', 'Aprobado', NOW() - INTERVAL '2 hours', 'Efectivo')
ON CONFLICT (id) DO NOTHING;

-- ====================================================================================
-- CREACIÓN DE BUCKETS DE STORAGE (SI NO EXISTEN)
-- ====================================================================================

INSERT INTO storage.buckets (id, name, public) VALUES 
('documentos_clientes', 'documentos_clientes', true),
('recaudos', 'recaudos', true),
('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_anon_all_doc" ON storage.objects FOR ALL TO public USING (bucket_id = 'documentos_clientes') WITH CHECK (bucket_id = 'documentos_clientes');
CREATE POLICY "storage_anon_all_rec" ON storage.objects FOR ALL TO public USING (bucket_id = 'recaudos') WITH CHECK (bucket_id = 'recaudos');
CREATE POLICY "storage_anon_all_com" ON storage.objects FOR ALL TO public USING (bucket_id = 'comprobantes') WITH CHECK (bucket_id = 'comprobantes');
