import { supabase } from "@/lib/supabase";

export interface ReporteComisionRow {
  vendedorId: string;
  nombreVendedor: string;
  cantidadVentas: number;
  totalVendido: number;
  porcentajeComision: number;
  totalComision: number;
}

/**
 * Obtiene el reporte de comisiones agrupado por vendedor 
 * para un mes y año específicos.
 */
export async function obtenerReporteComisiones(
  mes: number,
  anio: number
): Promise<ReporteComisionRow[]> {
  // Construir primer y último día del mes (formato YYYY-MM-DD)
  const startDate = new Date(anio, mes - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(anio, mes, 0).toISOString().split("T")[0];

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
        porcentaje_comision
      )
    `)
    .or(`and(fecha_venta.gte.${startDate},fecha_venta.lte.${endDate}),and(fecha_penalidad.gte.${startDate},fecha_penalidad.lte.${endDate})`);

  if (error) {
    throw new Error(`Error obteniendo reporte de comisiones: ${error.message}`);
  }

  // Agrupar por vendedor
  const map = new Map<string, ReporteComisionRow>();

  for (const row of data || []) {
    const usuario = Array.isArray(row.usuarios) ? row.usuarios[0] : row.usuarios;
    
    // Si la venta no tiene vendedor asignado (o el usuario fue eliminado), omitimos
    if (!usuario) continue;

    const vendedorId = usuario.id;
    const nombreVendedor = usuario.nombre_completo;
    const porcentajeComision = Number(usuario.porcentaje_comision) || 0;

    if (!map.has(vendedorId)) {
      map.set(vendedorId, {
        vendedorId,
        nombreVendedor,
        cantidadVentas: 0,
        totalVendido: 0,
        porcentajeComision,
        totalComision: 0,
      });
    }

    const current = map.get(vendedorId)!;

    const fechaVentaDate = row.fecha_venta?.split("T")[0];
    const fechaPenalidadDate = row.fecha_penalidad?.split("T")[0];
    
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
    current.totalComision = current.totalVendido * (current.porcentajeComision / 100);
  }

  return Array.from(map.values()).sort((a, b) => b.totalComision - a.totalComision);
}
