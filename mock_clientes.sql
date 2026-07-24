-- Script para crear 10 clientes de prueba rápidamente
-- Cópialo y pégalo en el SQL Editor de Supabase y dale a "Run" (Ejecutar)

DO $$ 
DECLARE 
    v_ruta_id UUID;
    v_codigo_base INT;
BEGIN
    -- 1. Intentar obtener la primera ruta disponible
    SELECT id INTO v_ruta_id FROM rutas LIMIT 1;
    
    -- Si por alguna razón no hay ninguna ruta, creamos una de prueba
    IF v_ruta_id IS NULL THEN
        INSERT INTO rutas (codigo_ruta, nombre_ruta, dias_visita) 
        VALUES ('RT-TEST', 'Ruta de Prueba', '["Lunes", "Miércoles"]') 
        RETURNING id INTO v_ruta_id;
    END IF;

    -- 2. Obtener el número máximo del código consecutivo actual para evitar choques
    SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(codigo_consecutivo, '\D', '', 'g'), '') AS INT)), 0) 
    INTO v_codigo_base 
    FROM clientes;

    -- 3. Insertar 10 clientes en un bucle
    FOR i IN 1..10 LOOP
        INSERT INTO clientes (
            ruta_id, 
            codigo_consecutivo, 
            secuencia_visita, 
            nombres, 
            apellidos, 
            cedula, 
            telefono_principal, 
            direccion, 
            barrio, 
            ciudad, 
            estado
        ) VALUES (
            v_ruta_id,
            'CLI-' || (v_codigo_base + i),
            i * 10,
            'Cliente Prueba ' || i,
            'Automático ' || i,
            '999000' || i,
            '300123456' || i,
            'Calle Falsa 123 - Casa ' || i,
            'Barrio Centro',
            'Bucaramanga',
            'Activo'
        );
    END LOOP;
END $$;
