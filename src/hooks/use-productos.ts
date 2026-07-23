import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  type NuevoProductoInput,
  type ActualizarProductoInput,
} from "@/services/producto.service";

export const PRODUCTOS_QUERY_KEY = ["productos"] as const;

/** Lista todos los productos con React Query (stale 2 min) */
export function useProductos() {
  return useQuery({
    queryKey: PRODUCTOS_QUERY_KEY,
    queryFn: listarProductos,
    staleTime: 2 * 60_000,
  });
}

/** Mutación para crear un producto e invalidar la lista */
export function useCrearProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NuevoProductoInput) => crearProducto(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTOS_QUERY_KEY }),
  });
}

/** Mutación para actualizar un producto e invalidar la lista */
export function useActualizarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActualizarProductoInput }) =>
      actualizarProducto(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTOS_QUERY_KEY }),
  });
}

/** Mutación para eliminar un producto e invalidar la lista */
export function useEliminarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarProducto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTOS_QUERY_KEY }),
  });
}
