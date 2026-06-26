import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface DashboardKpis {
  carteraActiva: number;
  recaudosDelDia: number;
  clientesActivos: number;
  clientesEnMora: number;
}

export interface RecaudoDiario {
  dia: string;
  total: number;
}

const KPIS_VACIOS: DashboardKpis = {
  carteraActiva: 0,
  recaudosDelDia: 0,
  clientesActivos: 0,
  clientesEnMora: 0,
};

/**
 * Obtiene los KPIs principales del dashboard.
 * Por ahora devuelve ceros si Supabase no está configurado.
 * La estructura ya está lista para conectarse a las tablas reales.
 */
export async function obtenerKpisDashboard(): Promise<DashboardKpis> {
  if (!isSupabaseConfigured) return KPIS_VACIOS;

  try {
    const hoy = new Date().toISOString().slice(0, 10);

    const [cartera, recaudos, activos, mora] = await Promise.all([
      supabase
        .from("creditos")
        .select("saldo_pendiente")
        .eq("estado", "activo"),
      supabase
        .from("recaudos")
        .select("valor_recibido")
        .gte("created_at", `${hoy}T00:00:00`)
        .lte("created_at", `${hoy}T23:59:59`),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("estado", "activo"),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("estado", "mora"),
    ]);

    return {
      carteraActiva:
        cartera.data?.reduce(
          (acc, r: { saldo_pendiente: number | null }) =>
            acc + (Number(r.saldo_pendiente) || 0),
          0,
        ) ?? 0,
      recaudosDelDia:
        recaudos.data?.reduce(
          (acc, r: { valor_recibido: number | null }) =>
            acc + (Number(r.valor_recibido) || 0),
          0,
        ) ?? 0,
      clientesActivos: activos.count ?? 0,
      clientesEnMora: mora.count ?? 0,
    };
  } catch (error) {
    console.error("[dashboard] Error obteniendo KPIs:", error);
    return KPIS_VACIOS;
  }
}

/**
 * Recaudos agrupados por día de la semana actual.
 * Placeholder con datos en cero hasta conectar con Supabase.
 */
export async function obtenerRecaudosSemana(): Promise<RecaudoDiario[]> {
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return dias.map((dia) => ({ dia, total: 0 }));
}
