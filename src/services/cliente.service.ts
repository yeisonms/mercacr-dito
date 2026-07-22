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
  foto_casa_1_url: string | null;
  foto_casa_2_url: string | null;
  latitud: number | null;
  longitud: number | null;
  numero_cartera?: string | null;
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
  foto_casa_1_url?: string | null;
  foto_casa_2_url?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  numero_cartera?: string | null;
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
      latitud,
      longitud,
      numero_cartera,
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
/**
 * Calcula la distancia en kilómetros entre dos puntos geográficos usando la fórmula de Haversine.
 */
function calcularDistanciaHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

  // 2. Cargar clientes existentes en la ruta para calcular secuencia
  const { data: clientesRuta, error: errorClientes } = await supabase
    .from("clientes")
    .select("id, latitud, longitud, secuencia_visita")
    .eq("ruta_id", input.ruta_id)
    .order("secuencia_visita", { ascending: true });

  if (errorClientes) {
    console.error("Error al obtener clientes de la ruta:", errorClientes);
    throw errorClientes;
  }

  const totalEnRuta = clientesRuta?.length ?? 0;
  let secuenciaVisita = 1;

  if (totalEnRuta === 0) {
    secuenciaVisita = 1;
  } else if (
    input.latitud !== undefined &&
    input.latitud !== null &&
    input.longitud !== undefined &&
    input.longitud !== null
  ) {
    // Filtrar clientes de la ruta que tengan coordenadas GPS válidas
    const clientesConGps = (clientesRuta ?? []).filter(
      (c) => c.latitud !== null && c.longitud !== null
    );

    if (clientesConGps.length > 0) {
      // Encontrar el vecino más cercano
      let nearestClient = clientesConGps[0];
      let minDistance = calcularDistanciaHaversine(
        Number(input.latitud),
        Number(input.longitud),
        Number(nearestClient.latitud),
        Number(nearestClient.longitud)
      );

      for (let i = 1; i < clientesConGps.length; i++) {
        const dist = calcularDistanciaHaversine(
          Number(input.latitud),
          Number(input.longitud),
          Number(clientesConGps[i].latitud),
          Number(clientesConGps[i].longitud)
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestClient = clientesConGps[i];
        }
      }

      // La nueva secuencia es el vecino más cercano + 1
      secuenciaVisita = nearestClient.secuencia_visita + 1;

      // Desplazar +1 la secuencia de visitas de los clientes posteriores en la ruta
      const clientesADesplazar = (clientesRuta ?? []).filter(
        (c) => c.secuencia_visita >= secuenciaVisita
      );

      if (clientesADesplazar.length > 0) {
        const promesas = clientesADesplazar.map((c) =>
          supabase
            .from("clientes")
            .update({ secuencia_visita: c.secuencia_visita + 1 })
            .eq("id", c.id)
        );
        const resultados = await Promise.all(promesas);
        const errorShift = resultados.find((r) => r.error)?.error;
        if (errorShift) {
          console.error("Error al desplazar secuencia de visitas:", errorShift);
          throw errorShift;
        }
      }
    } else {
      // Si ningún cliente en la ruta tiene GPS, lo ponemos al final
      secuenciaVisita = totalEnRuta + 1;
    }
  } else {
    // Si el nuevo cliente no tiene coordenadas, lo agregamos al final de la ruta
    secuenciaVisita = totalEnRuta + 1;
  }

  // 3. Inserción del nuevo cliente
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombres: input.nombres,
      apellidos: input.apellidos,
      cedula: input.cedula || null,
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
      foto_casa_1_url: input.foto_casa_1_url ?? null,
      foto_casa_2_url: input.foto_casa_2_url ?? null,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
      numero_cartera: input.numero_cartera ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`El número de cédula ${input.cedula} ya se encuentra registrado en el sistema.`);
    }
    throw error;
  }
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
      foto_casa_1_url,
      foto_casa_2_url,
      latitud,
      longitud,
      numero_cartera,
      fecha_creacion,
      ruta:rutas ( nombre_ruta )
    `,
    )
    .eq("id", id)
    .maybeSingle();

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
  latitud?: number | null;
  longitud?: number | null;
  foto_cliente_url?: string | null;
  foto_cedula_frente_url?: string | null;
  foto_cedula_respaldo_url?: string | null;
  foto_casa_1_url?: string | null;
  foto_casa_2_url?: string | null;
  numero_cartera?: string | null;
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
      numero_cartera: input.numero_cartera ?? null,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
      foto_cliente_url: input.foto_cliente_url ?? null,
      foto_cedula_frente_url: input.foto_cedula_frente_url ?? null,
      foto_cedula_respaldo_url: input.foto_cedula_respaldo_url ?? null,
      foto_casa_1_url: input.foto_casa_1_url ?? null,
      foto_casa_2_url: input.foto_casa_2_url ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

