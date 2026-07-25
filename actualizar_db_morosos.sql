-- Script para agregar campos de Lista Negra / Bloqueo a la tabla clientes
ALTER TABLE public.clientes 
ADD COLUMN bloqueado BOOLEAN DEFAULT FALSE,
ADD COLUMN motivo_bloqueo VARCHAR(255);
