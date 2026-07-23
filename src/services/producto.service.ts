/**
 * producto.service.ts
 * Operaciones CRUD para la tabla `productos` de Supabase.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EstadoProducto = "Activo" | "Descontinuado";

export interface Producto {
  id: string;
  codigo_producto: string;
  nombre: string;
  descripcion: string | null;
  categoria?: string | null;
  precio_compra?: number;
  precio_contado: number;
  precio_credito: number;
  stock_disponible: number;
  estado: EstadoProducto;
  fecha_creacion?: string;
}

export interface NuevoProductoInput {
  codigo_producto: string;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  precio_compra?: number;
  precio_contado: number;
  precio_credito: number;
  stock_disponible: number;
}

export interface ActualizarProductoInput extends NuevoProductoInput {
  estado: EstadoProducto;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda colombiana.
 * Ej: 150000 → "$150.000,00"
 */
export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

// ─── Listar ───────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los productos ordenados por nombre ASC.
 */
export async function listarProductos(): Promise<Producto[]> {
  if (!isSupabaseConfigured) return PRODUCTOS_DEMO;

  const { data, error } = await supabase
    .from("productos")
    .select(
      "id, codigo_producto, nombre, descripcion, categoria, precio_compra, precio_contado, precio_credito, stock_disponible, estado",
    )
    .order("nombre", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Producto[];
}

// ─── Crear ────────────────────────────────────────────────────────────────────

/**
 * Inserta un nuevo producto.
 * @throws Error de Supabase si el código ya existe (unique constraint).
 */
export async function crearProducto(input: NuevoProductoInput): Promise<Producto> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado.");
  }

  const { data, error } = await supabase
    .from("productos")
    .insert({
      codigo_producto: input.codigo_producto.trim().toUpperCase(),
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      categoria: input.categoria?.trim() || null,
      precio_compra: input.precio_compra ? Number(input.precio_compra) : 0,
      precio_contado: Number(input.precio_contado),
      precio_credito: Number(input.precio_credito),
      stock_disponible: Math.max(0, Math.round(Number(input.stock_disponible))),
      estado: "Activo",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Producto;
}

// ─── Actualizar ───────────────────────────────────────────────────────────────

export async function actualizarProducto(
  id: string,
  input: ActualizarProductoInput,
): Promise<Producto> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado.");
  }

  const { data, error } = await supabase
    .from("productos")
    .update({
      codigo_producto: input.codigo_producto.trim().toUpperCase(),
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      categoria: input.categoria?.trim() || null,
      precio_compra: input.precio_compra ? Number(input.precio_compra) : 0,
      precio_contado: Number(input.precio_contado),
      precio_credito: Number(input.precio_credito),
      stock_disponible: Math.max(0, Math.round(Number(input.stock_disponible))),
      estado: input.estado,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Producto;
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────

export async function eliminarProducto(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado.");
  }

  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new Error("No se puede eliminar el producto porque ya tiene movimientos o ventas asociadas.");
    }
    throw error;
  }
}

// ─── Datos demo (sin Supabase) ────────────────────────────────────────────────

const PRODUCTOS_DEMO: Producto[] = [
  {
    id: "demo-1",
    codigo_producto: "DEMO-001",
    nombre: "Colchón Doble",
    descripcion: "Colchón doble ortopédico 140x190",
    precio_contado: 350000,
    precio_credito: 420000,
    stock_disponible: 8,
    estado: "Activo",
  },
  {
    id: "demo-2",
    codigo_producto: "DEMO-002",
    nombre: "Estufa 4 puestos",
    descripcion: "Estufa a gas con encendido automático",
    precio_contado: 280000,
    precio_credito: 340000,
    stock_disponible: 0,
    estado: "Activo",
  },
  {
    id: "demo-3",
    codigo_producto: "DEMO-003",
    nombre: "Televisor 32\"",
    descripcion: null,
    precio_contado: 599000,
    precio_credito: 720000,
    stock_disponible: 3,
    estado: "Descontinuado",
  },
];
