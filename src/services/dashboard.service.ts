import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface DashboardKpis {
  carteraActiva: number;
  recaudosDelDia: number;
  ventasDelMes: number;
  utilidadDelMes: number;
}

export interface RecaudoDiario {
  dia: string;
  total: number;
}

export interface EstadoCarteraData {
  name: string;
  value: number;
}

export interface TopCobrador {
  nombre: string;
  totalRecaudado: number;
}

export interface ClienteCritico {
  id: string;
  nombre: string;
  saldoPendiente: number;
  diasAtraso: number;
  fechaProximoPago: string;
}

const KPIS_VACIOS: DashboardKpis = {
  carteraActiva: 0,
  recaudosDelDia: 0,
  ventasDelMes: 0,
  utilidadDelMes: 0,
};

// Helper para formatear fechas a YYYY-MM-DD
function formatearFechaLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene los KPIs principales del dashboard.
 */
export async function obtenerKpisDashboard(): Promise<DashboardKpis> {
  if (!isSupabaseConfigured) return KPIS_VACIOS;

  try {
    const hoy = new Date();
    const hoyStr = formatearFechaLocal(hoy);
    
    // Rango del día actual (00:00:00 a 23:59:59)
    const startOfToday = `${hoyStr}T00:00:00.000Z`;
    const endOfToday = `${hoyStr}T23:59:59.999Z`;

    // Rango del mes actual
    const startOfMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const startOfMonthStr = `${formatearFechaLocal(startOfMonth)}T00:00:00.000Z`;
    
    const endOfMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const endOfMonthStr = `${formatearFechaLocal(endOfMonth)}T23:59:59.999Z`;

    // 1. Cartera Activa y Ventas del Mes
    // Consultamos los créditos creados en el mes actual para ventas,
    // y todos los créditos activos para cartera.
    const [creditosRes, recaudosRes, recaudosMesRes] = await Promise.all([
      supabase
        .from("creditos")
        .select("saldo_pendiente, valor_credito, valor_contado, tipo_venta, fecha_venta, estado"),
      supabase
        .from("recaudos")
        .select("valor_recibido")
        .eq("estado", "Aprobado")
        .gte("fecha_recaudo", startOfToday)
        .lte("fecha_recaudo", endOfToday),
      supabase
        .from("recaudos")
        .select("valor_recibido")
        .eq("estado", "Aprobado")
        .gte("fecha_recaudo", startOfMonthStr)
        .lte("fecha_recaudo", endOfMonthStr),
    ]);

    if (creditosRes.error) throw creditosRes.error;
    if (recaudosRes.error) throw recaudosRes.error;
    if (recaudosMesRes.error) throw recaudosMesRes.error;

    const todosCreditos = creditosRes.data ?? [];

    // Calcular Cartera Activa (Saldo pendiente de créditos que no están cancelados ni finalizados)
    const carteraActiva = todosCreditos
      .filter(c => c.estado !== "Cancelado" && c.estado !== "Finalizado")
      .reduce((sum, c) => sum + (Number(c.saldo_pendiente) || 0), 0);

    // Calcular Ventas del Mes (Creditos creados en el mes actual)
    const creditosMes = todosCreditos.filter(c => {
      if (!c.fecha_venta) return false;
      const fVenta = new Date(c.fecha_venta);
      return fVenta >= startOfMonth && fVenta <= endOfMonth;
    });

    const ventasDelMes = creditosMes.reduce((sum, c) => {
      // Si es crédito sumamos el valor_credito, si es de contado sumamos el valor_contado
      const valor = c.tipo_venta === "Contado" ? c.valor_contado : c.valor_credito;
      return sum + (Number(valor) || 0);
    }, 0);

    // Calcular Ventas de Contado del Mes (para utilidad)
    const ventasContadoMes = creditosMes
      .filter(c => c.tipo_venta === "Contado")
      .reduce((sum, c) => sum + (Number(c.valor_contado) || 0), 0);

    // Calcular Recaudos del Día Aprobados
    const recaudosDelDia = (recaudosRes.data ?? []).reduce(
      (sum, r) => sum + (Number(r.valor_recibido) || 0),
      0
    );

    // Calcular Recaudos del Mes Aprobados (para utilidad)
    const recaudosDelMes = (recaudosMesRes.data ?? []).reduce(
      (sum, r) => sum + (Number(r.valor_recibido) || 0),
      0
    );

    // 2. Suma de Gastos del Mes (Se eliminó la tabla gastos del MVP)
    let gastosDelMes = 0;

    // Utilidad = Recaudos aprobados + Ventas contado - Gastos
    const utilidadDelMes = (recaudosDelMes + ventasContadoMes) - gastosDelMes;

    return {
      carteraActiva,
      recaudosDelDia,
      ventasDelMes,
      utilidadDelMes,
    };
  } catch (error) {
    console.error("[dashboard] Error obteniendo KPIs:", error);
    return KPIS_VACIOS;
  }
}

/**
 * Obtiene los recaudos de los últimos 7 días.
 */
export async function obtenerRecaudosSemana(): Promise<RecaudoDiario[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const hoy = new Date();
    // 7 días atrás
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 6);
    
    const hace7DiasStr = `${formatearFechaLocal(hace7Dias)}T00:00:00.000Z`;

    const { data: recaudos, error } = await supabase
      .from("recaudos")
      .select("valor_recibido, fecha_recaudo")
      .eq("estado", "Aprobado")
      .gte("fecha_recaudo", hace7DiasStr)
      .order("fecha_recaudo", { ascending: true });

    if (error) throw error;

    // Inicializar mapa de los últimos 7 días con 0
    const mapaDias = new Map<string, number>();
    const nombresDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7Dias);
      d.setDate(hace7Dias.getDate() + i);
      const claveFecha = formatearFechaLocal(d);
      mapaDias.set(claveFecha, 0);
    }

    // Agrupar e integrar recaudos reales
    if (recaudos) {
      recaudos.forEach((r) => {
        if (!r.fecha_recaudo) return;
        // Obtener solo la parte de la fecha (YYYY-MM-DD)
        const fecha = r.fecha_recaudo.split("T")[0];
        if (mapaDias.has(fecha)) {
          mapaDias.set(fecha, (mapaDias.get(fecha) || 0) + Number(r.valor_recibido));
        }
      });
    }

    // Convertir a formato Recharts
    const resultado: RecaudoDiario[] = [];
    mapaDias.forEach((total, fechaStr) => {
      const parts = fechaStr.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const diaSemana = nombresDias[d.getDay()];
      const diaMes = d.getDate();
      resultado.push({
        dia: `${diaSemana} ${diaMes}`,
        total,
      });
    });

    return resultado;
  } catch (error) {
    console.error("[dashboard] Error en obtenerRecaudosSemana:", error);
    return [];
  }
}

/**
 * Obtiene la distribución del saldo de la cartera activa por su estado.
 */
export async function obtenerEstadoCartera(): Promise<EstadoCarteraData[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from("creditos")
      .select("saldo_pendiente, estado")
      .not("estado", "in", '("Cancelado","Finalizado")');

    if (error) throw error;

    const conteo: Record<string, number> = {
      "Al día": 0,
      "Próximo a vencer": 0,
      "Atrasado": 0,
      "En mora": 0,
    };

    if (data) {
      data.forEach((c) => {
        const est = c.estado || "Al día";
        if (conteo[est] !== undefined) {
          conteo[est] += Number(c.saldo_pendiente) || 0;
        } else {
          // Fallback por si hay otro estado
          conteo["Al día"] += Number(c.saldo_pendiente) || 0;
        }
      });
    }

    return Object.entries(conteo).map(([name, value]) => ({
      name,
      value,
    }));
  } catch (error) {
    console.error("[dashboard] Error en obtenerEstadoCartera:", error);
    return [];
  }
}

/**
 * Obtiene los cobradores del mes y el total recaudado aprobado.
 */
export async function obtenerTopCobradores(): Promise<TopCobrador[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const hoy = new Date();
    const startOfMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const startOfMonthStr = `${formatearFechaLocal(startOfMonth)}T00:00:00.000Z`;

    const { data, error } = await supabase
      .from("recaudos")
      .select(`
        valor_recibido,
        cobrador:usuarios!recaudos_cobrador_id_fkey ( nombre_completo )
      `)
      .eq("estado", "Aprobado")
      .gte("fecha_recaudo", startOfMonthStr);

    if (error) throw error;

    const mapaCobradores = new Map<string, number>();

    if (data) {
      data.forEach((r: any) => {
        const cobradorObj = Array.isArray(r.cobrador) ? r.cobrador[0] : r.cobrador;
        const nombre = cobradorObj?.nombre_completo || "Cobrador Desconocido";
        mapaCobradores.set(nombre, (mapaCobradores.get(nombre) || 0) + Number(r.valor_recibido));
      });
    }

    const resultado = Array.from(mapaCobradores.entries()).map(([nombre, totalRecaudado]) => ({
      nombre,
      totalRecaudado,
    }));

    // Ordenar de mayor a menor y limitar a los top 5
    return resultado.sort((a, b) => b.totalRecaudado - a.totalRecaudado).slice(0, 5);
  } catch (error) {
    console.error("[dashboard] Error en obtenerTopCobradores:", error);
    return [];
  }
}

/**
 * Obtiene los 5 clientes más críticos en mora.
 */
export async function obtenerClientesCriticos(): Promise<ClienteCritico[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { obtenerCarteraMorosa } = await import("./moraService");
    const morosos = await obtenerCarteraMorosa();
    
    // Filtrar aquellos que realmente tengan atraso y ordenar por días de atraso
    const criticos = morosos
      .filter(m => m.diasAtraso > 0)
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 5);

    return criticos.map(c => ({
      id: c.creditoId,
      nombre: c.nombreCliente,
      saldoPendiente: c.saldoVencido,
      diasAtraso: c.diasAtraso,
      fechaProximoPago: "", // El dashboard lo puede omitir o podemos mostrar que ya venció
    }));
  } catch (error) {
    console.error("[dashboard] Error en obtenerClientesCriticos:", error);
    return [];
  }
}
