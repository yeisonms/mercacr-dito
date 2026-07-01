/**
 * recaudoService.ts
 * Servicio para la gestión de recaudos (cobranzas) y subida de soportes.
 * Interactúa con las tablas: creditos, clientes, recaudos y usuarios.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ClienteInfo {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono_principal: string;
  barrio: string;
  latitud?: number | null;
  longitud?: number | null;
  secuencia_visita?: number;
}

export interface CreditoCobro {
  id: string; // credito_id
  saldo_pendiente: number;
  estado: "Al día" | "Próximo a vencer" | "Atrasado" | "En mora" | "Cancelado" | "Finalizado";
  numero_factura: string;
  cliente: ClienteInfo;
}

export interface RegistrarRecaudoInput {
  creditoId: string;
  valorRecibido: number;
  fotoDinero?: File | null;
  observaciones?: string;
}

export interface RecaudoPendiente {
  id: string;
  credito_id: string;
  valor_recibido: number;
  fecha_recaudo: string;
  soporte_foto_dinero_url: string | null;
  observaciones: string | null;
  estado: "Pendiente" | "Aprobado" | "Rechazado";
  credito: {
    id: string;
    numero_factura: string;
    saldo_pendiente: number;
    cliente: {
      id: string;
      nombres: string;
      apellidos: string;
      cedula: string;
    };
  } | null;
  cobrador: {
    id: string;
    nombre_completo: string;
  } | null;
}

/**
 * Obtiene los créditos activos que requieren cobro.
 * Filtra por estados: 'Al día', 'Próximo a vencer', 'En mora'.
 */
export async function obtenerCreditosCobro(): Promise<CreditoCobro[]> {
  if (!isSupabaseConfigured) {
    // Retornar datos simulados si Supabase no está configurado
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      {
        id: "cred-1",
        saldo_pendiente: 150000,
        estado: "Al día",
        numero_factura: "FAC-8831",
        cliente: {
          id: "cli-1",
          nombres: "Carlos Andrés",
          apellidos: "Gómez Montoya",
          cedula: "1056784920",
          telefono_principal: "3124567890",
          barrio: "San Javier",
          latitud: 5.5310,
          longitud: -74.1080,
          secuencia_visita: 1,
        },
      },
      {
        id: "cred-3",
        saldo_pendiente: 95000,
        estado: "Próximo a vencer",
        numero_factura: "FAC-1102",
        cliente: {
          id: "cli-3",
          nombres: "Diana Carolina",
          apellidos: "Zapata Vélez",
          cedula: "1017245689",
          telefono_principal: "3004561234",
          barrio: "Manrique",
          latitud: 5.5280,
          longitud: -74.1050,
          secuencia_visita: 2,
        },
      },
      {
        id: "cred-2",
        saldo_pendiente: 480000,
        estado: "En mora",
        numero_factura: "FAC-9012",
        cliente: {
          id: "cli-2",
          nombres: "Liliana María",
          apellidos: "Restrepo Osorio",
          cedula: "43890211",
          telefono_principal: "3156781234",
          barrio: "Aranjuez",
          latitud: 5.5340,
          longitud: -74.1120,
          secuencia_visita: 3,
        },
      },
      {
        id: "cred-4",
        saldo_pendiente: 230000,
        estado: "Al día",
        numero_factura: "FAC-7762",
        cliente: {
          id: "cli-4",
          nombres: "Jorge Mario",
          apellidos: "Ramírez Toro",
          cedula: "70987654",
          telefono_principal: "3209876543",
          barrio: "La Candelaria",
          latitud: 5.5350,
          longitud: -74.1040,
          secuencia_visita: 4,
        },
      },
      {
        id: "cred-5",
        saldo_pendiente: 620000,
        estado: "En mora",
        numero_factura: "FAC-3498",
        cliente: {
          id: "cli-5",
          nombres: "Martha Ligia",
          apellidos: "Patiño Ruiz",
          cedula: "32456789",
          telefono_principal: "3182345678",
          barrio: "Robledo",
          latitud: 5.5250,
          longitud: -74.1150,
          secuencia_visita: 5,
        },
      },
    ];
  }

  // Consulta real uniendo creditos y clientes (incluyendo latitud, longitud y secuencia_visita)
  const { data, error } = await supabase
    .from("creditos")
    .select(`
      id,
      saldo_pendiente,
      estado,
      numero_factura,
      cliente:clientes (
        id,
        nombres,
        apellidos,
        cedula,
        telefono_principal,
        barrio,
        latitud,
        longitud,
        secuencia_visita
      )
    `)
    .in("estado", ["Al día", "Próximo a vencer", "En mora"]);

  if (error) {
    console.error("Error al obtener créditos para cobranza:", error);
    throw new Error(`Error al cargar la ruta de cobro: ${error.message}`);
  }

  return (data ?? [])
    .map((item: any) => {
      const clienteRaw = Array.isArray(item.cliente) ? item.cliente[0] : item.cliente;
      return {
        id: item.id,
        saldo_pendiente: Number(item.saldo_pendiente),
        estado: item.estado,
        numero_factura: item.numero_factura,
        cliente: clienteRaw
          ? {
              id: clienteRaw.id,
              nombres: clienteRaw.nombres,
              apellidos: clienteRaw.apellidos,
              cedula: clienteRaw.cedula,
              telefono_principal: clienteRaw.telefono_principal,
              barrio: clienteRaw.barrio,
              latitud: clienteRaw.latitud ? Number(clienteRaw.latitud) : null,
              longitud: clienteRaw.longitud ? Number(clienteRaw.longitud) : null,
              secuencia_visita: Number(clienteRaw.secuencia_visita || 0),
            }
          : {
              id: "desconocido",
              nombres: "Cliente",
              apellidos: "Desconocido",
              cedula: "",
              telefono_principal: "",
              barrio: "N/A",
              latitud: null,
              longitud: null,
              secuencia_visita: 0,
            },
      };
    })
    .sort((a, b) => (a.cliente?.secuencia_visita || 0) - (b.cliente?.secuencia_visita || 0));
}

/**
 * Sube una foto de soporte al bucket 'documentos_clientes'.
 * Se guarda en la subcarpeta 'recaudos/' organizada por creditoId.
 */
export async function subirFotoSoporte(creditoId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const nombreSanitizado = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 30);
  const timestamp = Date.now();
  const ruta = `recaudos/${creditoId}/${timestamp}_${nombreSanitizado}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("documentos_clientes")
    .upload(ruta, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Error al subir archivo a Supabase Storage:", uploadError);
    throw new Error(`Error al subir la foto de soporte: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("documentos_clientes").getPublicUrl(ruta);
  return data.publicUrl;
}

/**
 * Obtiene o crea un cobrador_id válido en la tabla usuarios para no romper la FK.
 */
async function obtenerCobradorId(): Promise<string> {
  const { data: rol } = await supabase
    .from("roles")
    .select("id")
    .eq("nombre_rol", "Cobrador")
    .single();

  if (rol) {
    const { data: cobradores } = await supabase
      .from("usuarios")
      .select("id")
      .eq("rol_id", rol.id)
      .limit(1);

    if (cobradores && cobradores.length > 0) {
      return cobradores[0].id;
    }
  }

  const { data: cualquierUsuario } = await supabase
    .from("usuarios")
    .select("id")
    .limit(1);

  if (cualquierUsuario && cualquierUsuario.length > 0) {
    return cualquierUsuario[0].id;
  }

  const rolId = rol?.id || 3;
  const { data: nuevoUsuario, error } = await supabase
    .from("usuarios")
    .insert({
      nombre_completo: "Cobrador por Defecto",
      email: `cobrador.default.${Date.now()}@mercacredito.com`,
      password_hash: "cobrador_default_pwd_hash",
      rol_id: rolId,
      estado: "Activo",
    })
    .select("id")
    .single();

  if (error || !nuevoUsuario) {
    throw new Error(
      `Error al crear usuario cobrador de respaldo: ${error?.message || "No retornó datos"}`
    );
  }

  return nuevoUsuario.id;
}

/**
 * Registra un nuevo recaudo en estado 'Pendiente' en la base de datos.
 * NO altera el saldo_pendiente del crédito.
 */
export async function registrarRecaudo(input: RegistrarRecaudoInput): Promise<string> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("[recaudoService] Recaudo registrado con éxito (Simulado):", input);
    return `mock-recaudo-${Date.now()}`;
  }

  const cobradorId = await obtenerCobradorId();

  let fotoUrl: string | null = null;
  if (input.fotoDinero) {
    fotoUrl = await subirFotoSoporte(input.creditoId, input.fotoDinero);
  }

  const { data, error } = await supabase
    .from("recaudos")
    .insert({
      credito_id: input.creditoId,
      cobrador_id: cobradorId,
      valor_recibido: input.valorRecibido,
      soporte_foto_dinero_url: fotoUrl,
      observaciones: input.observaciones || null,
      estado: "Pendiente",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error al insertar el recaudo:", error);
    throw new Error(`Error al guardar el pago: ${error?.message || "No retornó ID"}`);
  }

  return data.id;
}

/**
 * Obtiene todos los recaudos en estado 'Pendiente'.
 * Une las relaciones de créditos, clientes y cobradores.
 */
export async function obtenerRecaudosPendientes(): Promise<RecaudoPendiente[]> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      {
        id: "rec-p-1",
        credito_id: "cred-1",
        valor_recibido: 50000,
        fecha_recaudo: new Date(Date.now() - 3600000 * 2.5).toISOString(), // Hace 2.5 horas
        soporte_foto_dinero_url: "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=500&auto=format&fit=crop&q=60",
        observaciones: "Abono cuota semanal del cliente",
        estado: "Pendiente",
        credito: {
          id: "cred-1",
          numero_factura: "FAC-8831",
          saldo_pendiente: 150000,
          cliente: {
            id: "cli-1",
            nombres: "Carlos Andrés",
            apellidos: "Gómez Montoya",
            cedula: "1056784920",
          },
        },
        cobrador: {
          id: "usr-1",
          nombre_completo: "Jaime Alberto Cobrador",
        },
      },
      {
        id: "rec-p-2",
        credito_id: "cred-2",
        valor_recibido: 120000,
        fecha_recaudo: new Date(Date.now() - 3600000 * 5.2).toISOString(), // Hace 5.2 horas
        soporte_foto_dinero_url: null,
        observaciones: "Pago parcial de la cuota atrasada",
        estado: "Pendiente",
        credito: {
          id: "cred-2",
          numero_factura: "FAC-9012",
          saldo_pendiente: 480000,
          cliente: {
            id: "cli-2",
            nombres: "Liliana María",
            apellidos: "Restrepo Osorio",
            cedula: "43890211",
          },
        },
        cobrador: {
          id: "usr-2",
          nombre_completo: "Andrea Zuluaga Cobradora",
        },
      },
      {
        id: "rec-p-3",
        credito_id: "cred-3",
        valor_recibido: 95000,
        fecha_recaudo: new Date(Date.now() - 3600000 * 24).toISOString(), // Hace 1 día
        soporte_foto_dinero_url: "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=500&auto=format&fit=crop&q=60",
        observaciones: "Pago total para liquidar saldo",
        estado: "Pendiente",
        credito: {
          id: "cred-3",
          numero_factura: "FAC-1102",
          saldo_pendiente: 95000,
          cliente: {
            id: "cli-3",
            nombres: "Diana Carolina",
            apellidos: "Zapata Vélez",
            cedula: "1017245689",
          },
        },
        cobrador: {
          id: "usr-1",
          nombre_completo: "Jaime Alberto Cobrador",
        },
      },
    ];
  }

  const { data, error } = await supabase
    .from("recaudos")
    .select(`
      id,
      credito_id,
      valor_recibido,
      fecha_recaudo,
      soporte_foto_dinero_url,
      observaciones,
      estado,
      credito:creditos (
        id,
        numero_factura,
        saldo_pendiente,
        cliente:clientes (
          id,
          nombres,
          apellidos,
          cedula
        )
      ),
      cobrador:usuarios!cobrador_id (
        id,
        nombre_completo
      )
    `)
    .eq("estado", "Pendiente")
    .order("fecha_recaudo", { ascending: false });

  if (error) {
    console.error("Error al obtener recaudos pendientes:", error);
    throw new Error(`Error al cargar los recaudos pendientes: ${error.message}`);
  }

  return (data ?? []).map((item: any) => {
    const creditoRaw = Array.isArray(item.credito) ? item.credito[0] : item.credito;
    const cobradorRaw = Array.isArray(item.cobrador) ? item.cobrador[0] : item.cobrador;
    const clienteRaw = creditoRaw
      ? Array.isArray(creditoRaw.cliente)
        ? creditoRaw.cliente[0]
        : creditoRaw.cliente
      : null;

    return {
      id: item.id,
      credito_id: item.credito_id,
      valor_recibido: Number(item.valor_recibido),
      fecha_recaudo: item.fecha_recaudo,
      soporte_foto_dinero_url: item.soporte_foto_dinero_url,
      observaciones: item.observaciones,
      estado: item.estado,
      credito: creditoRaw
        ? {
            id: creditoRaw.id,
            numero_factura: creditoRaw.numero_factura,
            saldo_pendiente: Number(creditoRaw.saldo_pendiente),
            cliente: clienteRaw
              ? {
                  id: clienteRaw.id,
                  nombres: clienteRaw.nombres,
                  apellidos: clienteRaw.apellidos,
                  cedula: clienteRaw.cedula,
                }
              : {
                  id: "desconocido",
                  nombres: "Cliente",
                  apellidos: "Desconocido",
                  cedula: "",
                },
          }
        : null,
      cobrador: cobradorRaw
        ? {
            id: cobradorRaw.id,
            nombre_completo: cobradorRaw.nombre_completo,
          }
        : {
            id: "desconocido",
            nombre_completo: "Cobrador Desconocido",
          },
    };
  });
}

/**
 * Aprueba un recaudo.
 * 1. Consulta el saldo pendiente actual del crédito.
 * 2. Cambia el estado del recaudo a 'Aprobado' y registra fecha_revision.
 * 3. Resta el valor del saldo del crédito. Si llega a <= 0, cambia el crédito a 'Finalizado'.
 */
export async function aprobarRecaudo(
  recaudoId: string,
  creditoId: string,
  valorRecibido: number
): Promise<void> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`[recaudoService] Recaudo ${recaudoId} Aprobado (Simulado). Crédito: ${creditoId}. Valor: ${valorRecibido}`);
    return;
  }

  // Paso A: Obtener el saldo del crédito actual
  const { data: credito, error: errorCreditoGet } = await supabase
    .from("creditos")
    .select("saldo_pendiente")
    .eq("id", creditoId)
    .single();

  if (errorCreditoGet || !credito) {
    throw new Error(
      `No se pudo consultar el saldo actual del crédito: ${errorCreditoGet?.message || "No encontrado"}`
    );
  }

  const saldoActual = Number(credito.saldo_pendiente);
  const nuevoSaldo = Math.max(0, saldoActual - valorRecibido);

  // Paso B: Marcar recaudo como Aprobado
  const { error: errorRecaudoUpdate } = await supabase
    .from("recaudos")
    .update({
      estado: "Aprobado",
      fecha_revision: new Date().toISOString(),
    })
    .eq("id", recaudoId);

  if (errorRecaudoUpdate) {
    throw new Error(`Error al aprobar el recaudo: ${errorRecaudoUpdate.message}`);
  }

  // Paso C: Descontar el saldo en creditos. Si nuevo saldo es 0, finalizar crédito.
  const { error: errorCreditoUpdate } = await supabase
    .from("creditos")
    .update({
      saldo_pendiente: nuevoSaldo,
      ...(nuevoSaldo <= 0 ? { estado: "Finalizado" } : {}),
    })
    .eq("id", creditoId);

  if (errorCreditoUpdate) {
    throw new Error(`Error al actualizar el saldo del crédito: ${errorCreditoUpdate.message}`);
  }
}

/**
 * Rechaza un recaudo.
 * Cambia el estado a 'Rechazado', registra fecha_revision y guarda el motivo en observaciones.
 * NO altera el saldo pendiente del crédito.
 */
export async function rechazarRecaudo(recaudoId: string, motivo: string): Promise<void> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`[recaudoService] Recaudo ${recaudoId} Rechazado (Simulado). Motivo: ${motivo}`);
    return;
  }

  // 1. Obtener observaciones previas para no sobreescribirlas
  const { data: recaudo, error: errorGet } = await supabase
    .from("recaudos")
    .select("observaciones")
    .eq("id", recaudoId)
    .single();

  if (errorGet) {
    throw new Error(`No se pudo obtener la información del recaudo: ${errorGet.message}`);
  }

  const obsAnterior = recaudo?.observaciones ? `${recaudo.observaciones}\n` : "";
  const nuevasObservaciones = `${obsAnterior}Motivo de rechazo: ${motivo}`;

  // 2. Actualizar el recaudo a Rechazado con su motivo
  const { error: errorUpdate } = await supabase
    .from("recaudos")
    .update({
      estado: "Rechazado",
      fecha_revision: new Date().toISOString(),
      observaciones: nuevasObservaciones,
    })
    .eq("id", recaudoId);

  if (errorUpdate) {
    throw new Error(`Error al rechazar el recaudo: ${errorUpdate.message}`);
  }
}
