-- Habilitar valores nulos para la columna cedula en la tabla clientes
ALTER TABLE public.clientes ALTER COLUMN cedula DROP NOT NULL;

-- Si actualmente hay clientes con cédulas vacías "", podemos convertirlas a NULL
-- para evitar violaciones de unicidad en caso de que cedula sea UNIQUE
UPDATE public.clientes SET cedula = NULL WHERE trim(cedula) = '';
