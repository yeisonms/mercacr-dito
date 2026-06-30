/**
 * cliente.service.ts
 * Operaciones de base de datos para el módulo de Clientes.
 * La subida de archivos está en storage.service.ts.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface Ruta {
  id: string;
  nombre: string;
}

/** Estados posibles de un cliente, alineados con el CHECK del schema SQL */
export type EstadoCliente =
  | "Activo"
  | "Inactivo"
  | "Moroso"
  | "Judicial"
  | "Finalizado";

/** Tipo completo de un cliente tal como viene de la tabla `clientes` */
export interface Cliente {
  id: string;
  codigo_consecutivo: string;
  secuencia_visita: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono_principal: string;
  telefono_alterno: string | null;
  direccion: string;
  barrio: string;
  ciudad: string;
  lugar_trabajo: string | null;
  telefono_trabajo: string | null;
  ruta_id: string;
  estado: EstadoCliente;
  foto_cliente_url: string | null;
  foto_cedula_frente_url: string | null;
  foto_cedula_respaldo_url: string | null;
  fecha_creacion: string;
  /** Nombre de la ruta, resultado del JOIN con tabla `rutas` */
  ruta?: { nombre_ruta: string } | null;
}

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
  // URLs de documentos (opcionales, resueltas por storage.service antes de llegar aquí)
  foto_cliente_url?: string | null;
  foto_cedula_frente_url?: string | null;
  foto_cedula_respaldo_url?: string | null;
}

// ─── Rutas ───────────────────────────────────────────────────────────────────

/**
 * Carga las rutas activas desde la tabla `rutas` de Supabase.
 * Devuelve lista de fallback de desarrollo si Supabase no está configurado.
 */
export async function listarRutas(): Promise<Ruta[]> {
  if (!isSupabaseConfigured) {
    return [
      { id: "norte", nombre: "Norte" },
      { id: "sur", nombre: "Sur" },
      { id: "centro", nombre: "Centro" },
    ];
  }

  const { data, error } = await supabase
    .from("rutas")
    .select("id, nombre_ruta")
    .eq("estado", "Activa")
    .order("nombre_ruta");

  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, nombre: r.nombre_ruta }));
}

// ─── Clientes — Lectura ─────────────────────────────────────────────────────

/**
 * Devuelve todos los clientes ordenados por fecha_creacion DESC.
 * Incluye el nombre de la ruta asignada mediante JOIN.
 *
 * @param busqueda  Texto para filtrar en el backend (opcional).
 *                 El filtro principal se hace en el frontend para UX en tiempo real.
 */
export async function listarClientes(): Promise<Cliente[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("clientes")
    .select(
      `
      id,
      codigo_consecutivo,
      secuencia_visita,
      nombres,
      apellidos,
      cedula,
      telefono_principal,
      telefono_alterno,
      direccion,
      barrio,
      ciudad,
      lugar_trabajo,
      telefono_trabajo,
      ruta_id,
      estado,
      foto_cliente_url,
      foto_cedula_frente_url,
      foto_cedula_respaldo_url,
      fecha_creacion,
      ruta:rutas ( nombre_ruta )
    `,
    )
    .order("fecha_creacion", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((raw: any) => {
    const ruta = Array.isArray(raw.ruta) ? raw.ruta[0] : raw.ruta;
    return { ...raw, ruta } as unknown as Cliente;
  });
}

// ─── Clientes — Escritura ────────────────────────────────────────────────────

/**
 * Inserta un nuevo cliente en la tabla `clientes` de Supabase.
 * - Genera `codigo_consecutivo` (CLI-00001) contando los registros existentes.
 * - Genera `secuencia_visita` contando los clientes ya asignados a la ruta.
 * - Acepta las URLs de documentos ya subidos al Storage.
 *
 * @throws Error de Supabase si la inserción falla (ej: cédula duplicada).
 */
export async function crearCliente(input: NuevoClienteInput) {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env.",
    );
  }

  // 1. Código consecutivo global: CLI-00001, CLI-00002, …
  const { count: totalClientes } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true });

  const codigoConsecutivo = `CLI-${String((totalClientes ?? 0) + 1).padStart(5, "0")}`;

  // 2. Secuencia de visita dentro de la ruta
  const { count: totalEnRuta } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("ruta_id", input.ruta_id);

  const secuenciaVisita = (totalEnRuta ?? 0) + 1;

  // 3. Inserción
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
      estado: "Activo",
      codigo_consecutivo: codigoConsecutivo,
      secuencia_visita: secuenciaVisita,
      foto_cliente_url: input.foto_cliente_url ?? null,
      foto_cedula_frente_url: input.foto_cedula_frente_url ?? null,
      foto_cedula_respaldo_url: input.foto_cedula_respaldo_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Obtener uno ─────────────────────────────────────────────────────────────

/**
 * Obtiene un cliente por su ID incluyendo el nombre de la ruta (JOIN).
 * @throws Error si no existe o si Supabase falla.
 */
export async function obtenerCliente(id: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .select(
      `
      id,
      codigo_consecutivo,
      secuencia_visita,
      nombres,
      apellidos,
      cedula,
      telefono_principal,
      telefono_alterno,
      direccion,
      barrio,
      ciudad,
      lugar_trabajo,
      telefono_trabajo,
      ruta_id,
      estado,
      foto_cliente_url,
      foto_cedula_frente_url,
      foto_cedula_respaldo_url,
      fecha_creacion,
      ruta:rutas ( nombre_ruta )
    `,
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) return null as any;
  const ruta = Array.isArray(data.ruta) ? data.ruta[0] : data.ruta;
  return { ...data, ruta } as unknown as Cliente;
}

// ─── Actualizar ───────────────────────────────────────────────────────────────

export interface ActualizarClienteInput {
  nombres: string;
  apellidos: string;
  telefono_principal: string;
  telefono_alterno?: string | null;
  direccion: string;
  barrio: string;
  ciudad: string;
  lugar_trabajo?: string | null;
  telefono_trabajo?: string | null;
  ruta_id: string;
  estado: EstadoCliente;
}

/**
 * Actualiza los campos editables de un cliente.
 * La cédula y el código consecutivo son inmutables.
 */
export async function actualizarCliente(
  id: string,
  input: ActualizarClienteInput,
) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado.");
  }

  const { data, error } = await supabase
    .from("clientes")
    .update({
      nombres: input.nombres,
      apellidos: input.apellidos,
      telefono_principal: input.telefono_principal,
      telefono_alterno: input.telefono_alterno ?? null,
      direccion: input.direccion,
      barrio: input.barrio,
      ciudad: input.ciudad,
      lugar_trabajo: input.lugar_trabajo ?? null,
      telefono_trabajo: input.telefono_trabajo ?? null,
      ruta_id: input.ruta_id,
      estado: input.estado,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

