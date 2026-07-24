import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export interface VentaHistorialRow {
  id: string;
  numeroFactura: string;
  fechaVenta: string;
  tipoVenta: string;
  valorCredito: number;
  valorContado: number;
  estado: string;
  clienteId: string;
  clienteNombres: string;
  clienteApellidos: string;
  clienteCedula: string;
  vendedorId: string;
  vendedorNombre: string;
}

export interface FiltrosHistorial {
  fechaInicio: Date;
  fechaFin: Date;
  vendedorId?: string | "all";
}

export async function obtenerHistorialVentas({
  fechaInicio,
  fechaFin,
  vendedorId,
}: FiltrosHistorial): Promise<VentaHistorialRow[]> {
  // Ajustar la fecha inicio a inicio del día y la fecha fin a fin del día
  const start = new Date(fechaInicio);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fechaFin);
  end.setHours(23, 59, 59, 999);

  let query = supabase
    .from("creditos")
    .select(`
      id,
      numero_factura,
      fecha_venta,
      tipo_venta,
      valor_credito,
      valor_contado,
      estado,
      cliente_id,
      clientes:cliente_id (nombres, apellidos, cedula),
      vendedor_id,
      usuarios:vendedor_id (nombre_completo)
    `)
    .gte("fecha_venta", start.toISOString())
    .lte("fecha_venta", end.toISOString())
    .order("fecha_venta", { ascending: false });

  if (vendedorId && vendedorId !== "all") {
    query = query.eq("vendedor_id", vendedorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error obteniendo el historial de ventas: ${error.message}`);
  }

  return (data || []).map((row: any) => {
    const cliente = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;
    const usuario = Array.isArray(row.usuarios) ? row.usuarios[0] : row.usuarios;

    return {
      id: row.id,
      numeroFactura: row.numero_factura,
      fechaVenta: row.fecha_venta,
      tipoVenta: row.tipo_venta,
      valorCredito: Number(row.valor_credito) || 0,
      valorContado: Number(row.valor_contado) || 0,
      estado: row.estado,
      clienteId: row.cliente_id,
      clienteNombres: cliente?.nombres || "Desconocido",
      clienteApellidos: cliente?.apellidos || "",
      clienteCedula: cliente?.cedula || "N/A",
      vendedorId: row.vendedor_id,
      vendedorNombre: usuario?.nombre_completo || "Desconocido",
    };
  });
}
