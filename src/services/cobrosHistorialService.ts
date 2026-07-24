import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface CobroHistorialRow {
  id: string;
  fechaRecaudo: string;
  valorRecibido: number;
  metodoPago: "Efectivo" | "Transferencia";
  estado: string;
  cobradorNombre: string;
  clienteNombres: string;
  clienteApellidos: string;
  clienteCedula: string;
  numeroFactura: string;
}

export interface ObtenerHistorialCobrosParams {
  fechaInicio: Date;
  fechaFin: Date;
  cobradorId?: string | null;
}

export async function obtenerHistorialCobros(
  params: ObtenerHistorialCobrosParams
): Promise<CobroHistorialRow[]> {
  const { fechaInicio, fechaFin, cobradorId } = params;

  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      {
        id: "mock-1",
        fechaRecaudo: new Date().toISOString(),
        valorRecibido: 150000,
        metodoPago: "Efectivo",
        estado: "Aprobado",
        cobradorNombre: "Juan Pérez",
        clienteNombres: "Carlos Andrés",
        clienteApellidos: "Gómez Montoya",
        clienteCedula: "1056784920",
        numeroFactura: "FAC-8831",
      },
    ];
  }

  let query = supabase
    .from("recaudos")
    .select(`
      id,
      valor_recibido,
      fecha_recaudo,
      metodo_pago,
      estado,
      cobrador:usuarios!recaudos_cobrador_id_fkey(nombre_completo),
      credito:creditos(
        numero_factura,
        cliente:clientes(nombres, apellidos, cedula)
      )
    `)
    .gte("fecha_recaudo", fechaInicio.toISOString())
    .lte("fecha_recaudo", fechaFin.toISOString())
    .order("fecha_recaudo", { ascending: false });

  if (cobradorId && cobradorId !== "all") {
    query = query.eq("cobrador_id", cobradorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener historial de cobros:", error);
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => {
    // Si la DB no tiene "metodo_pago", lo inferimos por defecto
    const metodoPago = row.metodo_pago || "Efectivo";

    return {
      id: row.id,
      fechaRecaudo: row.fecha_recaudo,
      valorRecibido: Number(row.valor_recibido),
      metodoPago: metodoPago,
      estado: row.estado,
      cobradorNombre: row.cobrador?.nombre_completo || "Desconocido",
      clienteNombres: row.credito?.cliente?.nombres || "Desconocido",
      clienteApellidos: row.credito?.cliente?.apellidos || "",
      clienteCedula: row.credito?.cliente?.cedula || "",
      numeroFactura: row.credito?.numero_factura || "",
    };
  });
}
