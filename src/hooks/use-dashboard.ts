import { useQuery } from "@tanstack/react-query";
import {
  obtenerKpisDashboard,
  obtenerRecaudosSemana,
  obtenerEstadoCartera,
  obtenerTopCobradores,
  obtenerClientesCriticos,
} from "@/services/dashboard.service";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: obtenerKpisDashboard,
  });
}

export function useRecaudosSemana() {
  return useQuery({
    queryKey: ["dashboard", "recaudos-semana"],
    queryFn: obtenerRecaudosSemana,
  });
}

export function useEstadoCartera() {
  return useQuery({
    queryKey: ["dashboard", "estado-cartera"],
    queryFn: obtenerEstadoCartera,
  });
}

export function useTopCobradores() {
  return useQuery({
    queryKey: ["dashboard", "top-cobradores"],
    queryFn: obtenerTopCobradores,
  });
}

export function useClientesCriticos() {
  return useQuery({
    queryKey: ["dashboard", "clientes-criticos"],
    queryFn: obtenerClientesCriticos,
  });
}
