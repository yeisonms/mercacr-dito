import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ClienteBusqueda {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  codigo_consecutivo: string;
}

export interface CreditoResumen {
  id: string;
  valorCredito: number;
  valorContado: number;
  saldoPendiente: number;
  fechaVenta: string;
  fechaProximoPago: string | null;
  estado: string;
  tipoVenta: string;
  numeroFactura: string;
  numeroCuotas: number;
  frecuenciaPago: string | null;
}

export interface CuotaDetalle {
  id: string;
  numeroCuota: number;
  fechaVencimiento: string;
  valorCuota: number;
  valorPagado: number;
  saldoCuota: number;
  estado: "Pendiente" | "Parcial" | "Pagada" | "En Mora";
}

export interface RecaudoDetalle {
  id: string;
  fecha: string;
  valorRecibido: number;
  cobrador: string;
  observaciones: string | null;
  estado: "Pendiente" | "Aprobado" | "Rechazado";
}

export interface EstadoCuentaResponse {
  cliente: {
    id: string;
    nombres: string;
    apellidos: string;
    cedula: string;
    telefono: string;
    direccion: string;
    barrio: string;
    ciudad: string;
    estado: string;
    codigoConsecutivo: string;
  } | null;
  credito: CreditoResumen | null;
  cuotas: CuotaDetalle[];
  recaudos: RecaudoDetalle[];
}

/**
 * Obtiene todos los clientes para el buscador autocompletable.
 */
export async function buscarClientesParaEstadoCuenta(): Promise<ClienteBusqueda[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombres, apellidos, cedula, codigo_consecutivo")
    .order("nombres");

  if (error) {
    console.error("[estadoCuentaService] Error al buscar clientes:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * Obtiene el estado de cuenta completo del cliente:
 * - Datos del cliente
 * - Crédito activo (o el más reciente si no hay activo)
 * - Tabla de amortización (cuotas) de ese crédito
 * - Historial de recaudos aplicados a ese crédito (sin join a usuarios para evitar
 *   ambigüedad entre cobrador_id y revisado_por)
 */
export async function obtenerEstadoCuenta(clienteId: string): Promise<EstadoCuentaResponse> {
  if (!isSupabaseConfigured) {
    return { cliente: null, credito: null, cuotas: [], recaudos: [] };
  }

  try {
    // 1. Obtener datos del cliente
    const { data: clientData, error: clientError } = await supabase
      .from("clientes")
      .select(
        "id, nombres, apellidos, cedula, telefono_principal, direccion, barrio, ciudad, estado, codigo_consecutivo"
      )
      .eq("id", clienteId)
      .single();

    if (clientError) {
      console.error("[estadoCuentaService] Error cargando cliente:", clientError);
      throw clientError;
    }
    if (!clientData) return { cliente: null, credito: null, cuotas: [], recaudos: [] };

    // 2. Obtener todos los créditos del cliente (más recientes primero)
    const { data: creditos, error: creditsError } = await supabase
      .from("creditos")
      .select(
        "id, valor_credito, valor_contado, saldo_pendiente, fecha_venta, fecha_proximo_pago, estado, tipo_venta, numero_factura, numero_cuotas, frecuencia_pago"
      )
      .eq("cliente_id", clienteId)
      .order("fecha_venta", { ascending: false });

    if (creditsError) {
      console.error("[estadoCuentaService] Error cargando créditos:", creditsError);
      throw creditsError;
    }

    // Preferir crédito vigente (no Finalizado ni Cancelado), o el más reciente
    let creditoActual = null;
    if (creditos && creditos.length > 0) {
      creditoActual =
        creditos.find((c) => c.estado !== "Finalizado" && c.estado !== "Cancelado") ||
        creditos[0];
    }

    // Si el cliente existe pero no tiene créditos, devolver solo su info
    if (!creditoActual) {
      return {
        cliente: mapCliente(clientData),
        credito: null,
        cuotas: [],
        recaudos: [],
      };
    }

    // 3a. Cuotas del crédito seleccionado
    const { data: cuotasData, error: cuotasError } = await supabase
      .from("cuotas")
      .select("id, numero_cuota, fecha_vencimiento, valor_cuota, valor_pagado, saldo_cuota, estado")
      .eq("credito_id", creditoActual.id)
      .order("numero_cuota", { ascending: true });

    if (cuotasError) {
      console.error("[estadoCuentaService] Error cargando cuotas:", cuotasError);
      throw cuotasError;
    }

    // 3b. Recaudos — SIN join a usuarios para evitar ambigüedad de FK múltiple.
    //     Traemos cobrador_id y luego consultamos el nombre en una segunda query.
    const { data: recaudosData, error: recaudosError } = await supabase
      .from("recaudos")
      .select(
        "id, fecha_recaudo, valor_recibido, observaciones, estado, cobrador_id"
      )
      .eq("credito_id", creditoActual.id)
      .order("fecha_recaudo", { ascending: false });

    if (recaudosError) {
      console.error("[estadoCuentaService] Error cargando recaudos:", recaudosError);
      throw recaudosError;
    }

    // 3c. Resolver nombres de cobradores (si hay recaudos con cobrador_id)
    const cobradorIds = [
      ...new Set(
        (recaudosData ?? [])
          .map((r) => r.cobrador_id)
          .filter(Boolean)
      ),
    ];

    let cobradoresMap: Record<string, string> = {};
    if (cobradorIds.length > 0) {
      const { data: cobradoresData } = await supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .in("id", cobradorIds);

      if (cobradoresData) {
        cobradoresMap = Object.fromEntries(
          cobradoresData.map((u) => [u.id, u.nombre_completo])
        );
      }
    }

    // Mapear cuotas
    const cuotasMapped: CuotaDetalle[] = (cuotasData ?? []).map((q) => ({
      id: q.id,
      numeroCuota: q.numero_cuota,
      fechaVencimiento: q.fecha_vencimiento,
      valorCuota: Number(q.valor_cuota) || 0,
      valorPagado: Number(q.valor_pagado) || 0,
      saldoCuota: Number(q.saldo_cuota) || 0,
      estado: q.estado as CuotaDetalle["estado"],
    }));

    // Mapear recaudos
    const recaudosMapped: RecaudoDetalle[] = (recaudosData ?? []).map((r) => ({
      id: r.id,
      fecha: r.fecha_recaudo,
      valorRecibido: Number(r.valor_recibido) || 0,
      cobrador: cobradoresMap[r.cobrador_id] || "Sistema / Vendedor",
      observaciones: r.observaciones,
      estado: r.estado as RecaudoDetalle["estado"],
    }));

    return {
      cliente: mapCliente(clientData),
      credito: {
        id: creditoActual.id,
        valorCredito: Number(creditoActual.valor_credito) || 0,
        valorContado: Number(creditoActual.valor_contado) || 0,
        saldoPendiente: Number(creditoActual.saldo_pendiente) || 0,
        fechaVenta: creditoActual.fecha_venta,
        fechaProximoPago: creditoActual.fecha_proximo_pago,
        estado: creditoActual.estado,
        tipoVenta: creditoActual.tipo_venta,
        numeroFactura: creditoActual.numero_factura,
        numeroCuotas: Number(creditoActual.numero_cuotas) || 0,
        frecuenciaPago: creditoActual.frecuencia_pago,
      },
      cuotas: cuotasMapped,
      recaudos: recaudosMapped,
    };
  } catch (error) {
    console.error("[estadoCuentaService] Error general:", error);
    throw error;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function mapCliente(c: any) {
  return {
    id: c.id,
    nombres: c.nombres,
    apellidos: c.apellidos,
    cedula: c.cedula,
    telefono: c.telefono_principal,
    direccion: c.direccion,
    barrio: c.barrio,
    ciudad: c.ciudad,
    estado: c.estado,
    codigoConsecutivo: c.codigo_consecutivo ?? "",
  };
}
