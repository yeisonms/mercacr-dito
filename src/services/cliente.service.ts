import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface NuevoClienteInput {
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono_principal: string;
  telefono_alterno?: string | null;
  direccion: string;
  barrio: string;
  ciudad: string;
  lugar_trabajo?: string | null;
  telefono_trabajo?: string | null;
  ruta_id: string;
}

export interface Ruta {
  id: string;
  nombre: string;
}

/**
 * Simula la carga de rutas disponibles. En producción debería leer de la tabla `rutas`.
 */
export async function listarRutas(): Promise<Ruta[]> {
  return [
    { id: "norte", nombre: "Norte" },
    { id: "sur", nombre: "Sur" },
    { id: "centro", nombre: "Centro" },
  ];
}

/**
 * Inserta un nuevo cliente en la tabla `clientes` de Supabase.
 * El `codigo_consecutivo`, `saldo_pendiente` y `estado` se asumen con
 * valores por defecto definidos en la base de datos.
 */
export async function crearCliente(input: NuevoClienteInput) {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env.",
    );
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombres: input.nombres,
      apellidos: input.apellidos,
      cedula: input.cedula,
      telefono_principal: input.telefono_principal,
      telefono_alterno: input.telefono_alterno ?? null,
      direccion: input.direccion,
      barrio: input.barrio,
      ciudad: input.ciudad,
      lugar_trabajo: input.lugar_trabajo ?? null,
      telefono_trabajo: input.telefono_trabajo ?? null,
      ruta_id: input.ruta_id,
      estado: "activo",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
