/**
 * rutaService.ts
 * Servicio para la gestión de rutas y reordenación de visitas de clientes.
 * Interactúa con las tablas: rutas, clientes, creditos y usuarios.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface RutaConCobrador {
  id: string;
  codigo_ruta: string;
  nombre_ruta: string;
  cobrador_id: string | null;
  cobrador?: {
    nombre_completo: string;
  } | null;
}

export interface ClienteRuta {
  id: string;
  codigo_consecutivo: string;
  secuencia_visita: number;
  nombres: string;
  apellidos: string;
  barrio: string;
  saldo_pendiente: number;
}

export interface CobradorInfo {
  id: string;
  nombre_completo: string;
}

// Datos simulados de desarrollo
const MOCK_COBRADORES: CobradorInfo[] = [
  { id: "usr-1", nombre_completo: "Jaime Alberto Cobrador" },
  { id: "usr-2", nombre_completo: "Andrea Zuluaga Cobradora" },
];

const MOCK_RUTAS: RutaConCobrador[] = [
  {
    id: "ruta-1",
    codigo_ruta: "NOR",
    nombre_ruta: "Ruta Norte",
    cobrador_id: "usr-1",
    cobrador: { nombre_completo: "Jaime Alberto Cobrador" },
  },
  {
    id: "ruta-2",
    codigo_ruta: "SUR",
    nombre_ruta: "Ruta Sur",
    cobrador_id: "usr-2",
    cobrador: { nombre_completo: "Andrea Zuluaga Cobradora" },
  },
];

const MOCK_CLIENTES: Record<string, ClienteRuta[]> = {
  "ruta-1": [
    { id: "cli-101", codigo_consecutivo: "CLI-00001", secuencia_visita: 1, nombres: "Carlos", apellidos: "Gómez", barrio: "San Javier", saldo_pendiente: 150000 },
    { id: "cli-102", codigo_consecutivo: "CLI-00002", secuencia_visita: 2, nombres: "Liliana", apellidos: "Restrepo", barrio: "Aranjuez", saldo_pendiente: 480000 },
    { id: "cli-103", codigo_consecutivo: "CLI-00003", secuencia_visita: 3, nombres: "Diana", apellidos: "Zapata", barrio: "Manrique", saldo_pendiente: 95000 },
  ],
  "ruta-2": [
    { id: "cli-201", codigo_consecutivo: "CLI-00004", secuencia_visita: 1, nombres: "Jorge", apellidos: "Ramírez", barrio: "La Candelaria", saldo_pendiente: 230000 },
    { id: "cli-202", codigo_consecutivo: "CLI-00005", secuencia_visita: 2, nombres: "Martha", apellidos: "Patiño", barrio: "Robledo", saldo_pendiente: 620000 },
  ],
};

let localRutas = [...MOCK_RUTAS];
const localClientes = { ...MOCK_CLIENTES };

/**
 * Obtiene los usuarios activos con rol de Cobrador.
 */
export async function listarCobradores(): Promise<CobradorInfo[]> {
  if (!isSupabaseConfigured) {
    return MOCK_COBRADORES;
  }

  // 1. Obtener ID del rol Cobrador
  const { data: rol } = await supabase
    .from("roles")
    .select("id")
    .eq("nombre_rol", "Cobrador")
    .single();

  if (!rol) return [];

  // 2. Obtener usuarios asociados a ese rol
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nombre_completo")
    .eq("rol_id", rol.id)
    .eq("estado", "Activo")
    .order("nombre_completo");

  if (error) {
    console.error("Error al obtener cobradores:", error);
    throw new Error(`Error al listar cobradores: ${error.message}`);
  }

  return usuarios || [];
}

/**
 * Crea una nueva ruta en la base de datos.
 */
export async function crearRuta(
  codigo: string,
  nombre: string,
  cobradorId: string | null
): Promise<RutaConCobrador> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const cobradorAsignado = MOCK_COBRADORES.find((c) => c.id === cobradorId) || null;
    const nuevaRutaLocal: RutaConCobrador = {
      id: `ruta-${Date.now()}`,
      codigo_ruta: codigo.toUpperCase(),
      nombre_ruta: nombre,
      cobrador_id: cobradorId,
      cobrador: cobradorAsignado ? { nombre_completo: cobradorAsignado.nombre_completo } : null,
    };
    localRutas.push(nuevaRutaLocal);
    localClientes[nuevaRutaLocal.id] = [];
    return nuevaRutaLocal;
  }

  const { data, error } = await supabase
    .from("rutas")
    .insert({
      codigo_ruta: codigo.toUpperCase(),
      nombre_ruta: nombre,
      cobrador_id: cobradorId || null,
      estado: "Activa",
    })
    .select(`
      id,
      codigo_ruta,
      nombre_ruta,
      cobrador_id,
      cobrador:usuarios (
        nombre_completo
      )
    `)
    .single();

  if (error || !data) {
    console.error("Error al crear ruta:", error);
    throw new Error(`Error al guardar la ruta: ${error?.message || "No retornó datos"}`);
  }

  const cobradorRaw = Array.isArray(data.cobrador) ? data.cobrador[0] : data.cobrador;
  return {
    id: data.id,
    codigo_ruta: data.codigo_ruta,
    nombre_ruta: data.nombre_ruta,
    cobrador_id: data.cobrador_id,
    cobrador: cobradorRaw,
  };
}

/**
 * Obtiene todas las rutas activas junto con la información del cobrador.
 */
export async function listarRutasConCobradores(): Promise<RutaConCobrador[]> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...localRutas];
  }

  const { data, error } = await supabase
    .from("rutas")
    .select(`
      id,
      codigo_ruta,
      nombre_ruta,
      cobrador_id,
      cobrador:usuarios (
        nombre_completo
      )
    `)
    .eq("estado", "Activa")
    .order("nombre_ruta");

  if (error) {
    console.error("Error al listar rutas:", error);
    throw new Error(`Error al cargar las rutas: ${error.message}`);
  }

  return (data ?? []).map((r: any) => {
    const cobradorRaw = Array.isArray(r.cobrador) ? r.cobrador[0] : r.cobrador;
    return {
      id: r.id,
      codigo_ruta: r.codigo_ruta,
      nombre_ruta: r.nombre_ruta,
      cobrador_id: r.cobrador_id,
      cobrador: cobradorRaw,
    };
  });
}

/**
 * Obtiene los clientes asignados a una ruta específica,
 * calculando su saldo pendiente total (JOIN con créditos activos).
 * Ordenados por secuencia_visita ASC.
 */
export async function obtenerClientesPorRuta(rutaId: string): Promise<ClienteRuta[]> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return [...(localClientes[rutaId] || [])].sort((a, b) => a.secuencia_visita - b.secuencia_visita);
  }

  const { data, error } = await supabase
    .from("clientes")
    .select(`
      id,
      codigo_consecutivo,
      secuencia_visita,
      nombres,
      apellidos,
      barrio,
      creditos (
        saldo_pendiente,
        estado
      )
    `)
    .eq("ruta_id", rutaId)
    .order("secuencia_visita", { ascending: true });

  if (error) {
    console.error("Error al obtener clientes por ruta:", error);
    throw new Error(`Error al cargar clientes de la ruta: ${error.message}`);
  }

  return (data ?? []).map((c: any) => {
    const creditosList = c.creditos ? (Array.isArray(c.creditos) ? c.creditos : [c.creditos]) : [];
    // Sumar saldo pendiente solo de los créditos que sigan activos
    const totalSaldo = creditosList
      .filter((cr: any) => cr.estado !== "Cancelado" && cr.estado !== "Finalizado")
      .reduce((sum: number, cr: any) => sum + Number(cr.saldo_pendiente || 0), 0);

    return {
      id: c.id,
      codigo_consecutivo: c.codigo_consecutivo,
      secuencia_visita: Number(c.secuencia_visita || 0),
      nombres: c.nombres,
      apellidos: c.apellidos,
      barrio: c.barrio,
      saldo_pendiente: totalSaldo,
    };
  });
}

/**
 * Actualiza masivamente la secuencia_visita de una lista de clientes en Supabase.
 */
export async function guardarSecuenciasClientes(
  clientesSecuencias: { id: string; secuencia_visita: number }[]
): Promise<void> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Guardar los cambios localmente en memoria
    for (const item of clientesSecuencias) {
      for (const rutaId in localClientes) {
        const index = localClientes[rutaId].findIndex((c) => c.id === item.id);
        if (index !== -1) {
          localClientes[rutaId][index].secuencia_visita = item.secuencia_visita;
        }
      }
    }
    console.log("[rutaService] Secuencias locales actualizadas en memoria:", localClientes);
    return;
  }

  // Ejecutamos promesas en paralelo para actualizar en Supabase
  const promesas = clientesSecuencias.map((item) =>
    supabase
      .from("clientes")
      .update({ secuencia_visita: item.secuencia_visita })
      .eq("id", item.id)
  );

  const resultados = await Promise.all(promesas);

  // Validamos si hay algún error
  const errorDetectado = resultados.find((r) => r.error)?.error;
  if (errorDetectado) {
    console.error("Error al actualizar la secuencia masiva:", errorDetectado);
    throw new Error(`Error al guardar el nuevo orden: ${errorDetectado.message}`);
  }
}
