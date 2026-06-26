import { useQuery } from "@tanstack/react-query";
import {
  obtenerKpisDashboard,
  obtenerRecaudosSemana,
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
