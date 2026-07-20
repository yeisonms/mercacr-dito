-- ====================================================================================
-- 1. MÓDULO DE SEGURIDAD Y USUARIOS
-- ====================================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) UNIQUE NOT NULL CHECK (nombre_rol IN ('Administrador', 'Gerencia', 'Cobrador', 'Vendedor', 'Auxiliar')),
    descripcion TEXT
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Se puede enlazar con auth.users de Supabase posteriormente
    rol_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================================
-- 2. MÓDULO DE RUTAS Y LOGÍSTICA
-- ====================================================================================

CREATE TABLE rutas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_ruta VARCHAR(10) UNIQUE NOT NULL,
    nombre_ruta VARCHAR(100) NOT NULL,
    cobrador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    dias_visita JSONB, -- Ejemplo: '["Lunes", "Miércoles"]'
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Inactiva')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================================
-- 3. MÓDULO DE CLIENTES
-- ====================================================================================

CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruta_id UUID REFERENCES rutas(id) ON DELETE RESTRICT,
    codigo_consecutivo VARCHAR(20) UNIQUE NOT NULL,
    secuencia_visita INT NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    telefono_principal VARCHAR(20) NOT NULL,
    telefono_alterno VARCHAR(20),
    direccion VARCHAR(150) NOT NULL,
    barrio VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    lugar_trabajo VARCHAR(150),
    telefono_trabajo VARCHAR(20),
    referencias_familiares JSONB,
    referencias_personales JSONB,
    foto_cliente_url VARCHAR(255),
    foto_cedula_frente_url VARCHAR(255),
    foto_cedula_respaldo_url VARCHAR(255),
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo', 'Moroso', 'Judicial', 'Finalizado')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================================
-- 4. MÓDULO DE CATÁLOGO Y PRODUCTOS
-- ====================================================================================

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_producto VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_contado NUMERIC(12, 2) NOT NULL,
    precio_credito NUMERIC(12, 2) NOT NULL,
    stock_disponible INT DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Descontinuado')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================================
-- 5. MÓDULO FINANCIERO: CRÉDITOS Y VENTAS
-- ====================================================================================

CREATE TABLE creditos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT,
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    fecha_venta TIMESTAMPTZ DEFAULT NOW(),
    tipo_venta VARCHAR(20) NOT NULL CHECK (tipo_venta IN ('Contado', 'Credito')),
    valor_contado NUMERIC(12, 2) NOT NULL,
    valor_credito NUMERIC(12, 2) NOT NULL,
    cuota_inicial NUMERIC(12, 2) DEFAULT 0,
    saldo_pendiente NUMERIC(12, 2) NOT NULL,
    numero_cuotas INT DEFAULT 0,
    valor_cuota NUMERIC(12, 2) DEFAULT 0,
    frecuencia_pago VARCHAR(20) CHECK (frecuencia_pago IN ('Semanal', 'Quincenal', 'Mensual', 'Única', 'Decenal')),
    fecha_proximo_pago DATE,
    fecha_final_estimada DATE,
    estado VARCHAR(30) DEFAULT 'Al día' CHECK (estado IN ('Al día', 'Próximo a vencer', 'Atrasado', 'En mora', 'Cancelado', 'Finalizado'))
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
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Parcial', 'Pagada', 'En Mora'))
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
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
    fecha_revision TIMESTAMPTZ
);

-- ====================================================================================
-- 6. MÓDULO DE GESTIÓN DE CAMPO
-- ====================================================================================

CREATE TABLE registro_visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    cobrador_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    recaudo_id UUID REFERENCES recaudos(id) ON DELETE SET NULL,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    estado_gestion VARCHAR(30) NOT NULL CHECK (estado_gestion IN ('Visitado con Pago', 'No Encontrado', 'Promesa de Pago', 'Rehusó Pagar')),
    observaciones TEXT
);

CREATE TABLE promesas_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_visita_id UUID REFERENCES registro_visitas(id) ON DELETE CASCADE,
    fecha_compromiso DATE NOT NULL,
    valor_prometido NUMERIC(12, 2),
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Cumplida', 'Incumplida'))
);

-- ====================================================================================
-- 7. MÓDULO DE CONFIGURACIÓN Y ALERTAS
-- ====================================================================================

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
    estado_envio VARCHAR(30) DEFAULT 'Pendiente' CHECK (estado_envio IN ('Enviado', 'Fallido', 'Pendiente por reintentar')),
    fecha_envio TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================================
-- 8. MÓDULO DE AUDITORÍA INMUTABLE
-- ====================================================================================

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

-- ====================================================================================
-- INSERCIÓN DE DATOS INICIALES (ROLES Y CONFIGURACIÓN)
-- ====================================================================================

INSERT INTO roles (nombre_rol, descripcion) VALUES 
('Administrador', 'Control total del sistema y aprobaciones'),
('Gerencia', 'Visualización general y auditoría'),
('Cobrador', 'Gestión de campo y recaudo móvil'),
('Vendedor', 'Generación de créditos y ventas de contado'),
('Auxiliar', 'Gestión operativa limitada');

INSERT INTO configuracion_negocio (porcentaje_mora_mes_3, dias_gracia_mora, plantilla_recordatorio_antici, plantilla_mora_critica)
VALUES (5.00, 2, 'Hola, recuerda que mañana vence tu cuota con Mercacrédito.', 'Aviso urgente: Tu crédito presenta un atraso superior a 30 días.');