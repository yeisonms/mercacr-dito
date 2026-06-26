import { useQuery } from "@tanstack/react-query";
import { listarClientes } from "@/services/cliente.service";

/**
 * Hook que obtiene todos los clientes con React Query.
 * Refresca automáticamente cada 60 segundos.
 */
export function useClientes() {
  return useQuery({
    queryKey: ["clientes", "lista"],
    queryFn: listarClientes,
    staleTime: 60_000, // 1 min antes de considerar stale
  });
}
