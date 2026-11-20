/**
 * recaudoService.ts
 * Servicio para la gestión de recaudos (cobranzas) y subida de soportes.
 * Interactúa con las tablas: creditos, clientes, recaudos y usuarios.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { format } from "date-fns";

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
  numero_cartera?: string | null;
  codigo_consecutivo?: string | null;
}

export interface CreditoCobro {
  id: string; // credito_id
  saldo_pendiente: number;
  valor_credito: number;
  estado: "Al día" | "Próximo a vencer" | "Atrasado" | "En mora" | "Cancelado" | "Finalizado";
  numero_factura: string;
  tipo_venta?: string;
  valor_contado?: number | null;
  saldo_contado?: number | null;
  penalidad_aplicada?: boolean;
  fecha_limite_credicontado?: string | null;
  cliente: ClienteInfo;
}

export interface RegistrarRecaudoInput {
  creditoId: string;
  valorRecibido: number;
  metodoPago: "Efectivo" | "Transferencia";
  fotoDinero?: File | null;
  observaciones?: string;
  usuarioId?: string;
  origenPago?: "Ruta" | "Almacen" | "CuotaInicial";
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
export async function obtenerCreditosCobro(cobradorId?: string): Promise<CreditoCobro[]> {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  if (!isSupabaseConfigured) {
    // Retornar datos simulados si Supabase no está configurado
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      {
        id: "cred-1",
        saldo_pendiente: 150000,
        valor_credito: 1500000,
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
        valor_credito: 500000,
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
        valor_credito: 2000000,
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
        valor_credito: 800000,
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
        valor_credito: 1200000,
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

  // 1. Si hay cobradorId, buscar las rutas asignadas a él
  let rutaIds: string[] = [];
  if (cobradorId) {
    const { data: rutasData, error: errRutas } = await supabase
      .from("rutas")
      .select("id")
      .eq("cobrador_id", cobradorId);
    
    if (errRutas) {
      console.error("Error al obtener rutas del cobrador:", errRutas);
    }
    
    if (rutasData && rutasData.length > 0) {
      rutaIds = rutasData.map(r => r.id);
    } else {
      // El cobrador no tiene rutas asignadas, entonces no debe ver ningún crédito en cobranza
      return [];
    }
  }

  // Consulta real uniendo creditos y clientes (filtrando por fecha_proximo_pago <= hoy)
  let query = supabase
    .from("creditos")
    .select(`
      id,
      saldo_pendiente,
      valor_credito,
      estado,
      numero_factura,
      fecha_proximo_pago,
      tipo_venta,
      valor_contado,
      saldo_contado,
      penalidad_aplicada,
      fecha_limite_credicontado,
      cliente:clientes!inner (
        id,
        nombres,
        apellidos,
        cedula,
        telefono_principal,
        barrio,
        latitud,
        longitud,
        secuencia_visita,
        ruta_id,
        numero_cartera,
        codigo_consecutivo
      )
    `)
    .in("estado", ["Al día", "Próximo a vencer", "En mora"])
    .lte("fecha_proximo_pago", todayStr);

  if (cobradorId && rutaIds.length > 0) {
    query = query.in("cliente.ruta_id", rutaIds);
  }

  const { data, error } = await query;

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
        valor_credito: Number(item.valor_credito),
        estado: item.estado,
        numero_factura: item.numero_factura,
        tipo_venta: item.tipo_venta,
        valor_contado: item.valor_contado != null ? Number(item.valor_contado) : null,
        saldo_contado: item.saldo_contado != null ? Number(item.saldo_contado) : null,
        penalidad_aplicada: Boolean(item.penalidad_aplicada),
        fecha_limite_credicontado: item.fecha_limite_credicontado,
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
              numero_cartera: clienteRaw.numero_cartera ?? null,
              codigo_consecutivo: clienteRaw.codigo_consecutivo ?? null,
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
              numero_cartera: null,
              codigo_consecutivo: null,
            },
      };
    })
    .sort((a, b) => (a.cliente?.secuencia_visita || 0) - (b.cliente?.secuencia_visita || 0));
}

/**
 * Sube una foto de soporte al bucket 'documentos_clientes'.
 * Se guarda en la subcarpeta 'recaudos/' organizada por creditoId.
 */
import { compressImage } from "./imageOptimizationService";

export async function subirFotoSoporte(creditoId: string, originalFile: File): Promise<string> {
  const file = await compressImage(originalFile);
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

  let finalCobradorId = input.usuarioId;

  try {
    const { data: cred } = await supabase.from("creditos").select("cliente_id").eq("id", input.creditoId).single();
    if (cred?.cliente_id) {
      const { data: cli } = await supabase.from("clientes").select("ruta_id").eq("id", cred.cliente_id).single();
      if (cli?.ruta_id) {
        const { data: rut } = await supabase.from("rutas").select("cobrador_id").eq("id", cli.ruta_id).single();
        if (rut?.cobrador_id) {
          finalCobradorId = rut.cobrador_id;
        }
      }
    }
  } catch (err) {
    console.error("Error al buscar el cobrador asignado a la ruta:", err);
  }

  const cobradorId = finalCobradorId ?? await obtenerCobradorId();

  let fotoUrl: string | null = null;
  if (input.fotoDinero) {
    fotoUrl = await subirFotoSoporte(input.creditoId, input.fotoDinero);
  }

  const origenPago = input.origenPago || "Ruta";

  const { data, error } = await supabase
    .from("recaudos")
    .insert({
      credito_id: input.creditoId,
      cobrador_id: cobradorId,
      valor_recibido: input.valorRecibido,
      metodo_pago: input.metodoPago,
      soporte_foto_dinero_url: fotoUrl,
      observaciones: input.observaciones || null,
      estado: "Pendiente",
      origen_pago: origenPago,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error al insertar el recaudo:", error);
    throw new Error(`Error al guardar el pago: ${error?.message || "No retornó ID"}`);
  }

  // Lógica de auto-aprobación para efectivo (el dinero ya está en mano)
  if (input.metodoPago === "Efectivo") {
    try {
      await aprobarRecaudo(data.id, input.creditoId, input.valorRecibido);
    } catch (approveError) {
      console.error("Error al auto-aprobar recaudo en efectivo:", approveError);
      // Opcional: lanzar error o permitir que el recaudo quede pendiente para revisión manual
      // throw new Error(`El recaudo se guardó pero falló la auto-aprobación: ${(approveError as Error).message}`);
    }
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
    .select("saldo_pendiente, tipo_venta, saldo_contado, penalidad_aplicada, cliente_id")
    .eq("id", creditoId)
    .single();

  if (errorCreditoGet || !credito) {
    throw new Error(
      `No se pudo consultar el saldo actual del crédito: ${errorCreditoGet?.message || "No encontrado"}`
    );
  }

  const saldoActual = Number(credito.saldo_pendiente);
  let nuevoSaldo = Math.max(0, saldoActual - valorRecibido);
  
  let nuevoSaldoContado = credito.saldo_contado != null ? Number(credito.saldo_contado) : null;
  let descuentoProntoPago = false;

  if (credito.tipo_venta === "Credicontado" && !credito.penalidad_aplicada && nuevoSaldoContado !== null) {
    nuevoSaldoContado = Math.max(0, nuevoSaldoContado - valorRecibido);
    if (nuevoSaldoContado <= 0) {
      nuevoSaldo = 0; // Se pagó todo el saldo contado, se perdona el resto
      descuentoProntoPago = true;
    }
  }

  // Obtener observaciones actuales del recaudo si hubo descuento
  let nuevasObservacionesRecaudo = undefined;
  if (descuentoProntoPago) {
    const { data: rec } = await supabase.from("recaudos").select("observaciones").eq("id", recaudoId).single();
    const obsActual = rec?.observaciones ? `${rec.observaciones}\n` : "";
    nuevasObservacionesRecaudo = `${obsActual}Descuento por pronto pago (Credicontado)`;
  }

  // Paso B: Marcar recaudo como Aprobado
  const updateDataRecaudo: any = {
    estado: "Aprobado",
    fecha_revision: new Date().toISOString(),
  };
  if (nuevasObservacionesRecaudo) {
    updateDataRecaudo.observaciones = nuevasObservacionesRecaudo;
  }

  const { error: errorRecaudoUpdate } = await supabase
    .from("recaudos")
    .update(updateDataRecaudo)
    .eq("id", recaudoId);

  if (errorRecaudoUpdate) {
    throw new Error(`Error al aprobar el recaudo: ${errorRecaudoUpdate.message}`);
  }

  // Paso C: Sincronizar saldos en crédito y redistribuir pagos en amortización (cuotas)
  await sincronizarCreditoYCuotas(creditoId);

  // --- ACTUALIZACIÓN INTELIGENTE DE RUTA ---
  // Si hoy el cliente tenía ruta y no estaba visitado, lo marcamos automáticamente
  try {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const { data: visitaPendiente } = await supabase
      .from("registro_visitas")
      .select("id")
      .eq("cliente_id", credito.cliente_id)
      .eq("fecha_visita", todayStr)
      .is("recaudo_id", null) 
      .maybeSingle();

    if (visitaPendiente) {
      await supabase
        .from("registro_visitas")
        .update({
          estado: "Visitado con Pago",
          recaudo_id: recaudoId,
          observaciones: "Pago Libre / Automático",
          hora_gestion: new Date().toISOString()
        })
        .eq("id", visitaPendiente.id);
    }
  } catch (err) {
    console.warn("No se pudo auto-actualizar la visita de la ruta:", err);
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

/**
 * Actualiza en lote la secuencia_visita de los clientes en la base de datos.
 */
export async function actualizarSecuenciaRuta(
  actualizaciones: { clienteId: string; nuevaSecuencia: number }[]
): Promise<void> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("[recaudoService] Secuencia de ruta actualizada (Simulado).", actualizaciones);
    return;
  }

  // Supabase no soporta un UPDATE múltiple nativo con diferentes valores directamente en un solo query 
  // fácilmente sin usar RPC, pero podemos iterar o usar upsert.
  // Como estamos iterando sobre un número pequeño de clientes de una ruta diaria (ej: 20-50),
  // y lo hacemos en background, usar Promise.all con updates individuales es viable y seguro.
  const promises = actualizaciones.map((act) =>
    supabase
      .from("clientes")
      .update({ secuencia_visita: act.nuevaSecuencia })
      .eq("id", act.clienteId)
  );

  const results = await Promise.all(promises);

  const error = results.find((res) => res.error);
  if (error) {
    throw new Error(`Error al actualizar secuencias: ${error.error?.message}`);
  }
}

// ─── Sincronización y Corrección Financiera de Recaudos ──────────────────────

/**
 * Recalcula y redistribuye los pagos de un crédito en su amortización (cuotas),
 * actualizando el saldo_pendiente y saldo_contado con total consistencia.
 */
export async function sincronizarCreditoYCuotas(creditoId: string): Promise<{
  nuevoSaldoPendiente: number;
  nuevoSaldoContado: number | null;
}> {
  if (!isSupabaseConfigured) {
    return { nuevoSaldoPendiente: 0, nuevoSaldoContado: null };
  }

  // 1. Obtener información del crédito
  const { data: credito, error: credError } = await supabase
    .from("creditos")
    .select("id, valor_credito, valor_contado, cuota_inicial, tipo_venta, penalidad_aplicada, estado")
    .eq("id", creditoId)
    .single();

  if (credError || !credito) {
    throw new Error(`No se encontró el crédito para sincronizar: ${credError?.message || "Sin datos"}`);
  }

  // 2. Obtener todos los recaudos aprobados de este crédito
  const { data: recaudosAprobados, error: recError } = await supabase
    .from("recaudos")
    .select("valor_recibido")
    .eq("credito_id", creditoId)
    .eq("estado", "Aprobado");

  if (recError) {
    throw new Error(`Error consultando recaudos aprobados: ${recError.message}`);
  }

  const totalRecaudado = (recaudosAprobados || []).reduce(
    (sum, r) => sum + (Number(r.valor_recibido) || 0),
    0
  );

  // 3. Calcular saldos del crédito
  const cuotaInicial = Number(credito.cuota_inicial) || 0;
  const valorCredito = Number(credito.valor_credito) || 0;
  const valorContado = Number(credito.valor_contado) || 0;

  let nuevoSaldoPendiente = Math.max(0, valorCredito - cuotaInicial - totalRecaudado);
  let nuevoSaldoContado: number | null = null;

  if (credito.tipo_venta === "Credicontado" && !credito.penalidad_aplicada) {
    nuevoSaldoContado = Math.max(0, valorContado - cuotaInicial - totalRecaudado);
    // Si cumple credicontado y saldo contado llegó a 0, se perdona el resto (pronto pago)
    if (nuevoSaldoContado <= 0) {
      nuevoSaldoPendiente = 0;
    }
  } else if (credito.tipo_venta === "Credicontado" && credito.penalidad_aplicada) {
    nuevoSaldoContado = 0;
  }

  // Determinar nuevo estado del crédito
  let nuevoEstado = credito.estado;
  if (nuevoSaldoPendiente <= 0) {
    nuevoEstado = "Finalizado";
  } else if (credito.estado === "Finalizado" && nuevoSaldoPendiente > 0) {
    nuevoEstado = "Al día";
  }

  // Actualizar el crédito
  const { error: updateCredError } = await supabase
    .from("creditos")
    .update({
      saldo_pendiente: nuevoSaldoPendiente,
      ...(nuevoSaldoContado !== null ? { saldo_contado: nuevoSaldoContado } : {}),
      estado: nuevoEstado,
    })
    .eq("id", creditoId);

  if (updateCredError) {
    throw new Error(`Error al actualizar saldos del crédito: ${updateCredError.message}`);
  }

  // 4. Redistribuir pagos en las cuotas (Algoritmo FIFO)
  const { data: cuotas, error: cuotasError } = await supabase
    .from("cuotas")
    .select("id, numero_cuota, valor_cuota, valor_pagado, saldo_cuota, estado")
    .eq("credito_id", creditoId)
    .order("numero_cuota", { ascending: true });

  if (!cuotasError && cuotas && cuotas.length > 0) {
    let bolsa = totalRecaudado;

    for (const cuota of cuotas) {
      const valorCuota = Number(cuota.valor_cuota);
      let nvoPagado = 0;
      let nvoSaldo = valorCuota;
      let nvoEstado: "Pendiente" | "Parcial" | "Pagada" = "Pendiente";

      if (bolsa >= valorCuota) {
        nvoPagado = valorCuota;
        nvoSaldo = 0;
        nvoEstado = "Pagada";
        bolsa -= valorCuota;
      } else if (bolsa > 0) {
        nvoPagado = bolsa;
        nvoSaldo = valorCuota - bolsa;
        nvoEstado = "Parcial";
        bolsa = 0;
      } else {
        nvoPagado = 0;
        nvoSaldo = valorCuota;
        nvoEstado = "Pendiente";
      }

      if (
        nvoPagado !== Number(cuota.valor_pagado) ||
        nvoSaldo !== Number(cuota.saldo_cuota) ||
        nvoEstado !== cuota.estado
      ) {
        await supabase
          .from("cuotas")
          .update({
            valor_pagado: nvoPagado,
            saldo_cuota: nvoSaldo,
            estado: nvoEstado,
          })
          .eq("id", cuota.id);
      }
    }
  }

  return { nuevoSaldoPendiente, nuevoSaldoContado };
}

export interface CorregirRecaudoInput {
  recaudoId: string;
  nuevoValor: number;
  motivo: string;
  usuarioId?: string;
  usuarioNombre?: string;
}

/**
 * Corrige el valor monetario de un recaudo registrado y recalcula todo el impacto financiero.
 */
export async function corregirRecaudo(input: CorregirRecaudoInput): Promise<{
  nuevoSaldoPendiente: number;
  nuevoSaldoContado: number | null;
}> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { nuevoSaldoPendiente: 100000, nuevoSaldoContado: null };
  }

  if (input.nuevoValor <= 0) {
    throw new Error("El nuevo valor del recaudo debe ser mayor a 0");
  }

  if (!input.motivo || input.motivo.trim().length < 5) {
    throw new Error("Debes ingresar un motivo detallado de la corrección (mínimo 5 caracteres)");
  }

  // 1. Obtener el recaudo actual
  const { data: recaudo, error: errorRec } = await supabase
    .from("recaudos")
    .select("id, credito_id, valor_recibido, observaciones, estado")
    .eq("id", input.recaudoId)
    .single();

  if (errorRec || !recaudo) {
    throw new Error(`No se encontró el recaudo a corregir: ${errorRec?.message || "Sin datos"}`);
  }

  const valorAnterior = Number(recaudo.valor_recibido);
  const nuevoValor = Number(input.nuevoValor);

  // 2. Actualizar el recaudo
  const fechaHoyStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const notaAuditoria = `\n[CORRECCIÓN ${fechaHoyStr} por ${input.usuarioNombre || "Administrador"}]: Ajustado de $${valorAnterior.toLocaleString("es-CO")} a $${nuevoValor.toLocaleString("es-CO")}. Motivo: ${input.motivo.trim()}`;
  const observacionesActualizadas = `${recaudo.observaciones ? recaudo.observaciones : ""}${notaAuditoria}`.trim();

  const { error: updateRecError } = await supabase
    .from("recaudos")
    .update({
      valor_recibido: nuevoValor,
      observaciones: observacionesActualizadas,
      fecha_revision: new Date().toISOString(),
      ...(input.usuarioId ? { revisado_por: input.usuarioId } : {}),
    })
    .eq("id", input.recaudoId);

  if (updateRecError) {
    throw new Error(`Error al actualizar el recaudo: ${updateRecError.message}`);
  }

  // 3. Sincronizar saldos de crédito y tabla de amortización
  const { nuevoSaldoPendiente, nuevoSaldoContado } = await sincronizarCreditoYCuotas(recaudo.credito_id);

  // 4. Registrar en logs de auditoría
  try {
    await supabase.from("logs_auditoria").insert({
      usuario_id: input.usuarioId || null,
      accion: "CORRECCION_RECAUDO",
      tabla_afectada: "recaudos",
      registro_id: input.recaudoId,
      valores_anteriores: {
        valor_recibido: valorAnterior,
        estado: recaudo.estado,
      },
      valores_nuevos: {
        valor_recibido: nuevoValor,
        motivo: input.motivo.trim(),
        nuevo_saldo_pendiente: nuevoSaldoPendiente,
        nuevo_saldo_contado: nuevoSaldoContado,
        usuario_nombre: input.usuarioNombre || "Administrador",
      },
    });
  } catch (auditErr) {
    console.warn("No se pudo registrar log de auditoría:", auditErr);
  }

  return { nuevoSaldoPendiente, nuevoSaldoContado };
}

export interface AnularRecaudoInput {
  recaudoId: string;
  motivo: string;
  usuarioId?: string;
  usuarioNombre?: string;
}

/**
 * Anula un recaudo marcándolo como 'Rechazado' y revirtiendo su valor en el crédito y cuotas.
 */
export async function anularRecaudo(input: AnularRecaudoInput): Promise<{
  nuevoSaldoPendiente: number;
  nuevoSaldoContado: number | null;
}> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { nuevoSaldoPendiente: 100000, nuevoSaldoContado: null };
  }

  if (!input.motivo || input.motivo.trim().length < 5) {
    throw new Error("Debes ingresar un motivo detallado de la anulación (mínimo 5 caracteres)");
  }

  // 1. Obtener el recaudo actual
  const { data: recaudo, error: errorRec } = await supabase
    .from("recaudos")
    .select("id, credito_id, valor_recibido, observaciones, estado")
    .eq("id", input.recaudoId)
    .single();

  if (errorRec || !recaudo) {
    throw new Error(`No se encontró el recaudo a anular: ${errorRec?.message || "Sin datos"}`);
  }

  if (recaudo.estado === "Rechazado") {
    throw new Error("Este recaudo ya se encuentra anulado o rechazado.");
  }

  const valorAnterior = Number(recaudo.valor_recibido);

  // 2. Marcar recaudo como Rechazado
  const fechaHoyStr = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const notaAuditoria = `\n[ANULACIÓN ${fechaHoyStr} por ${input.usuarioNombre || "Administrador"}]: Recaudo ANULADO (era de $${valorAnterior.toLocaleString("es-CO")}). Motivo: ${input.motivo.trim()}`;
  const observacionesActualizadas = `${recaudo.observaciones ? recaudo.observaciones : ""}${notaAuditoria}`.trim();

  const { error: updateRecError } = await supabase
    .from("recaudos")
    .update({
      estado: "Rechazado",
      observaciones: observacionesActualizadas,
      fecha_revision: new Date().toISOString(),
      ...(input.usuarioId ? { revisado_por: input.usuarioId } : {}),
    })
    .eq("id", input.recaudoId);

  if (updateRecError) {
    throw new Error(`Error al anular el recaudo: ${updateRecError.message}`);
  }

  // 3. Sincronizar saldos de crédito y cuotas
  const { nuevoSaldoPendiente, nuevoSaldoContado } = await sincronizarCreditoYCuotas(recaudo.credito_id);

  // 4. Registrar en logs de auditoría
  try {
    await supabase.from("logs_auditoria").insert({
      usuario_id: input.usuarioId || null,
      accion: "ANULACION_RECAUDO",
      tabla_afectada: "recaudos",
      registro_id: input.recaudoId,
      valores_anteriores: {
        valor_recibido: valorAnterior,
        estado: recaudo.estado,
      },
      valores_nuevos: {
        estado: "Rechazado",
        motivo: input.motivo.trim(),
        nuevo_saldo_pendiente: nuevoSaldoPendiente,
        nuevo_saldo_contado: nuevoSaldoContado,
        usuario_nombre: input.usuarioNombre || "Administrador",
      },
    });
  } catch (auditErr) {
    console.warn("No se pudo registrar log de auditoría:", auditErr);
  }

  return { nuevoSaldoPendiente, nuevoSaldoContado };
}
