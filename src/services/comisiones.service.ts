import { supabase } from "@/lib/supabase";

export interface ReporteComisionVentasRow {
  vendedorId: string;
  nombreVendedor: string;
  cantidadVentas: number;
  totalVendido: number;
  porcentajeVentas: number;
  totalComision: number;
}

export interface ReporteComisionCobranzaRow {
  cobradorId: string;
  nombreCobrador: string;
  cantidadRecaudos: number;
  totalRecaudado: number;
  porcentajeCobranza: number;
  totalComision: number;
}

/**
 * Obtiene el reporte de comisiones agrupado por vendedor 
 * para un mes y año específicos.
 */
export async function obtenerReporteComisiones(
  mes: number,
  anio: number
): Promise<ReporteComisionVentasRow[]> {
  // Construir primer y último día del mes
  const startDate = new Date(anio, mes - 1, 1).toISOString();
  const endDate = new Date(anio, mes, 0, 23, 59, 59, 999).toISOString();

  const { data, error } = await supabase
    .from("creditos")
    .select(`
      valor_credito,
      valor_contado,
      tipo_venta,
      fecha_venta,
      fecha_penalidad,
      penalidad_aplicada,
      usuarios:vendedor_id (
        id, 
        nombre_completo, 
        porcentaje_ventas
      )
    `)
    .neq("estado", "Devuelto")
    .or(`and(fecha_venta.gte.${startDate},fecha_venta.lte.${endDate}),and(fecha_penalidad.gte.${startDate},fecha_penalidad.lte.${endDate})`);

  if (error) {
    throw new Error(`Error obteniendo reporte de comisiones: ${error.message}`);
  }

  // Agrupar por vendedor
  const map = new Map<string, ReporteComisionVentasRow>();

  for (const row of data || []) {
    const usuario = Array.isArray(row.usuarios) ? row.usuarios[0] : row.usuarios;
    
    // Si la venta no tiene vendedor asignado (o el usuario fue eliminado), omitimos
    if (!usuario) continue;

    const vendedorId = usuario.id;
    const nombreVendedor = usuario.nombre_completo;
    const porcentajeVentas = Number(usuario.porcentaje_ventas) || 0;

    if (!map.has(vendedorId)) {
      map.set(vendedorId, {
        vendedorId,
        nombreVendedor,
        cantidadVentas: 0,
        totalVendido: 0,
        porcentajeVentas,
        totalComision: 0,
      });
    }

    const current = map.get(vendedorId)!;

    const fechaVentaDate = row.fecha_venta || "";
    const fechaPenalidadDate = row.fecha_penalidad || "";
    
    const isVentaDelMes = fechaVentaDate >= startDate && fechaVentaDate <= endDate;
    const isPenalidadDelMes = row.penalidad_aplicada && fechaPenalidadDate && fechaPenalidadDate >= startDate && fechaPenalidadDate <= endDate;

    let baseComision = 0;

    if (isVentaDelMes) {
      if (row.tipo_venta === "Credicontado") {
        baseComision += Number(row.valor_contado) || 0;
      } else {
        baseComision += Number(row.valor_credito) || 0;
      }
      current.cantidadVentas += 1;
    }

    if (isPenalidadDelMes) {
      const extra = (Number(row.valor_credito) || 0) - (Number(row.valor_contado) || 0);
      baseComision += extra;
    }

    current.totalVendido += baseComision;
    current.totalComision = current.totalVendido * (current.porcentajeVentas / 100);
  }

  return Array.from(map.values()).sort((a, b) => b.totalComision - a.totalComision);
}

/**
 * Obtiene el reporte de comisiones agrupado por cobrador (para abonos/recaudos)
 * para un mes y año específicos.
 */
export async function obtenerReporteComisionesCobranza(
  mes: number,
  anio: number
): Promise<ReporteComisionCobranzaRow[]> {
  const startDate = new Date(anio, mes - 1, 1).toISOString();
  const endDate = new Date(anio, mes, 0, 23, 59, 59, 999).toISOString();

  const { data, error } = await supabase
    .from("recaudos")
    .select(`
      valor_recibido,
      estado,
      usuarios:cobrador_id (
        id, 
        nombre_completo, 
        porcentaje_cobranza
      )
    `)
    .gte("fecha_recaudo", startDate)
    .lte("fecha_recaudo", endDate)
    .eq("estado", "Aprobado");

  if (error) {
    throw new Error(`Error obteniendo reporte de comisiones de cobranza: ${error.message}`);
  }

  const map = new Map<string, ReporteComisionCobranzaRow>();

  for (const row of data || []) {
    const usuario = Array.isArray(row.usuarios) ? row.usuarios[0] : row.usuarios;
    
    if (!usuario) continue;

    const cobradorId = usuario.id;
    const nombreCobrador = usuario.nombre_completo;
    const porcentajeCobranza = Number(usuario.porcentaje_cobranza) || 0;

    if (!map.has(cobradorId)) {
      map.set(cobradorId, {
        cobradorId,
        nombreCobrador,
        cantidadRecaudos: 0,
        totalRecaudado: 0,
        porcentajeCobranza,
        totalComision: 0,
      });
    }

    const current = map.get(cobradorId)!;

    current.cantidadRecaudos += 1;
    current.totalRecaudado += Number(row.valor_recibido) || 0;
    current.totalComision = current.totalRecaudado * (current.porcentajeCobranza / 100);
  }

  return Array.from(map.values()).sort((a, b) => b.totalComision - a.totalComision);
}
