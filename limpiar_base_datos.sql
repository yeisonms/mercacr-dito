-- ====================================================================================
-- SCRIPT PARA LIMPIAR LA BASE DE DATOS (MANTENIENDO USUARIOS Y ROLES)
-- ====================================================================================

-- El comando TRUNCATE con CASCADE vaciará estas tablas y automáticamente 
-- cualquier otra tabla que dependa de ellas (hijas).
-- RESTART IDENTITY reinicia los contadores (por ejemplo, IDs autoincrementales).

TRUNCATE TABLE 
    rutas,
    clientes,
    productos,
    creditos,
    detalles_venta,
    cuotas,
    recaudos,
    registro_visitas,
    promesas_pago,
    historial_alertas,
    logs_auditoria
RESTART IDENTITY CASCADE;

-- NOTA SOBRE LAS FOTOS Y COMPROBANTES:
-- Las URLs de las fotos (cedulas, productos, comprobantes) se borran de la base de datos 
-- con este comando. Sin embargo, los archivos físicos en el Storage de Supabase 
-- (buckets como 'documentos_clientes', 'recaudos', etc.) deben ser vaciados manualmente 
-- desde el panel de Supabase > Storage, seleccionando los archivos y eliminándolos, 
-- o vaciando el bucket entero.
