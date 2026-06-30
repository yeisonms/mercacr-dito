import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  Edit3,
  Loader2,
  Package,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Tag,
  Warehouse,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  useProductos,
  useCrearProducto,
  useActualizarProducto,
} from "@/hooks/use-productos";
import {
  formatearMoneda,
  type Producto,
  type EstadoProducto,
} from "@/services/producto.service";

// ─── Ruta ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/productos")({
  head: () => ({
    meta: [
      { title: "Catálogo de Productos — Mercacrédito" },
      {
        name: "description",
        content: "Administración del catálogo de productos del ERP Mercacrédito.",
      },
    ],
  }),
  component: ProductosPage,
});

// ─── Schema Zod ───────────────────────────────────────────────────────────────

const precioPositivo = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `${campo} es requerido`)
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: `${campo} debe ser un número positivo`,
    });

const productoSchema = z.object({
  codigo_producto: z
    .string()
    .trim()
    .min(1, "El código es requerido")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[A-Za-z0-9\-_]+$/, "Solo letras, números, guiones y guion bajo"),
  nombre: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  precio_contado: precioPositivo("Precio de contado"),
  precio_credito: precioPositivo("Precio a crédito"),
  stock_disponible: z
    .string()
    .trim()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0 && Number.isInteger(Number(v)), {
      message: "Debe ser un número entero ≥ 0",
    }),
  estado: z.enum(["Activo", "Descontinuado"] as const).optional(),
});

type ProductoFormValues = z.infer<typeof productoSchema>;

const VALORES_INICIALES: ProductoFormValues = {
  codigo_producto: "",
  nombre: "",
  descripcion: "",
  precio_contado: "",
  precio_credito: "",
  stock_disponible: "0",
  estado: "Activo",
};

// ─── Configs visuales ─────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoProducto, { label: string; className: string }> = {
  Activo: {
    label: "Activo",
    className:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  },
  Descontinuado: {
    label: "Descontinuado",
    className: "bg-muted text-muted-foreground border-border",
  },
};

// ─── Página principal ─────────────────────────────────────────────────────────

function ProductosPage() {
  const { data: productos = [], isLoading, isError, refetch } = useProductos();
  const [busqueda, setBusqueda] = useState("");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  // Filtrado en tiempo real
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo_producto.toLowerCase().includes(q),
    );
  }, [productos, busqueda]);

  // Stats rápidas
  const totalActivos = productos.filter((p) => p.estado === "Activo").length;
  const sinStock = productos.filter((p) => p.stock_disponible === 0 && p.estado === "Activo").length;

  const abrirNuevo = () => {
    setProductoEditando(null);
    setDialogAbierto(true);
  };

  const abrirEditar = (producto: Producto) => {
    setProductoEditando(producto);
    setDialogAbierto(true);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => refetch()}
        title="Recargar"
        aria-label="Recargar catálogo"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button size="sm" onClick={abrirNuevo}>
        <Plus className="mr-2 h-4 w-4" />
        Agregar producto
      </Button>
    </div>
  );

  return (
    <AppShell
      title="Catálogo de Productos"
      subtitle="Gestión de inventario y precios"
      actions={headerActions}
    >
      <div className="space-y-4">
        {/* ── Stats ── */}
        {!isLoading && !isError && (
          <div className="flex flex-wrap gap-3">
            <StatChip icon={ShoppingBag} label="Total" value={productos.length} color="default" />
            <StatChip icon={Package} label="Activos" value={totalActivos} color="emerald" />
            {sinStock > 0 && (
              <StatChip icon={AlertTriangle} label="Sin stock" value={sinStock} color="red" />
            )}
          </div>
        )}

        {/* ── Tabla ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Inventario</CardTitle>
                <CardDescription>
                  {isLoading
                    ? "Cargando…"
                    : busqueda
                      ? `${productosFiltrados.length} de ${productos.length} productos`
                      : `${productos.length} producto${productos.length !== 1 ? "s" : ""} en catálogo`}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busqueda-productos"
                  placeholder="Buscar por nombre o código…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8"
                  autoComplete="off"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Error */}
            {isError && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm font-medium text-destructive">
                  No se pudo cargar el catálogo.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Reintentar
                </Button>
              </div>
            )}

            {!isError && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="w-[140px] text-right">
                        Precio contado
                      </TableHead>
                      <TableHead className="w-[140px] text-right">
                        Precio crédito
                      </TableHead>
                      <TableHead className="w-[100px] text-center">Stock</TableHead>
                      <TableHead className="w-[120px]">Estado</TableHead>
                      <TableHead className="w-[52px] text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {/* Skeletons */}
                    {isLoading &&
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonFila key={i} />
                      ))}

                    {/* Estado vacío */}
                    {!isLoading && productosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <EstadoVacio buscando={busqueda.length > 0} onNuevo={abrirNuevo} />
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Filas de datos */}
                    {!isLoading &&
                      productosFiltrados.map((producto) => (
                        <FilaProducto
                          key={producto.id}
                          producto={producto}
                          onEditar={() => abrirEditar(producto)}
                        />
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog crear/editar ── */}
      <DialogProducto
        abierto={dialogAbierto}
        onCerrar={() => {
          setDialogAbierto(false);
          setProductoEditando(null);
        }}
        productoEditando={productoEditando}
      />
    </AppShell>
  );
}

// ─── Fila de producto ─────────────────────────────────────────────────────────

function FilaProducto({
  producto,
  onEditar,
}: {
  producto: Producto;
  onEditar: () => void;
}) {
  const sinStock = producto.stock_disponible === 0;
  const cfg = ESTADO_CONFIG[producto.estado] ?? ESTADO_CONFIG.Descontinuado;

  return (
    <TableRow className="group transition-colors hover:bg-muted/40">
      <TableCell className="font-mono text-xs text-muted-foreground">
        {producto.codigo_producto}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Tag className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{producto.nombre}</p>
            {producto.descripcion && (
              <p className="truncate text-xs text-muted-foreground max-w-[220px]">
                {producto.descripcion}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums text-sm">
        {formatearMoneda(producto.precio_contado)}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums text-sm text-primary">
        {formatearMoneda(producto.precio_credito)}
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
                  sinStock
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "text-foreground"
                }`}
              >
                {sinStock && <AlertTriangle className="h-3 w-3" />}
                {producto.stock_disponible}
              </span>
            </TooltipTrigger>
            {sinStock && (
              <TooltipContent>
                <p className="text-xs">Sin stock disponible</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`whitespace-nowrap text-xs font-semibold ${cfg.className}`}
        >
          {cfg.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEditar}
          aria-label={`Editar ${producto.nombre}`}
        >
          <Edit3 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Dialog crear / editar ────────────────────────────────────────────────────

interface DialogProductoProps {
  abierto: boolean;
  onCerrar: () => void;
  productoEditando: Producto | null;
}

function DialogProducto({ abierto, onCerrar, productoEditando }: DialogProductoProps) {
  const esEdicion = productoEditando !== null;
  const crearMutation = useCrearProducto();
  const actualizarMutation = useActualizarProducto();
  const guardando = crearMutation.isPending || actualizarMutation.isPending;

  const form = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: VALORES_INICIALES,
    values: productoEditando
      ? {
          codigo_producto: productoEditando.codigo_producto,
          nombre: productoEditando.nombre,
          descripcion: productoEditando.descripcion ?? "",
          precio_contado: String(productoEditando.precio_contado),
          precio_credito: String(productoEditando.precio_credito),
          stock_disponible: String(productoEditando.stock_disponible),
          estado: productoEditando.estado,
        }
      : VALORES_INICIALES,
  });

  const onSubmit = (values: ProductoFormValues) => {
    const payload = {
      codigo_producto: values.codigo_producto,
      nombre: values.nombre,
      descripcion: values.descripcion || null,
      precio_contado: Number(values.precio_contado),
      precio_credito: Number(values.precio_credito),
      stock_disponible: Number(values.stock_disponible),
    };

    if (esEdicion && productoEditando) {
      actualizarMutation.mutate(
        { id: productoEditando.id, input: { ...payload, estado: values.estado as EstadoProducto ?? "Activo" } },
        {
          onSuccess: () => {
            toast.success("Producto actualizado correctamente");
            form.reset(VALORES_INICIALES);
            onCerrar();
          },
          onError: (err) => {
            const msg = err instanceof Error ? err.message : "Error al actualizar";
            toast.error("No se pudo actualizar", { description: msg });
          },
        },
      );
    } else {
      crearMutation.mutate(payload, {
        onSuccess: (nuevo) => {
          toast.success(`"${nuevo.nombre}" agregado al catálogo`);
          form.reset(VALORES_INICIALES);
          onCerrar();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          const description = msg.includes("duplicate") || msg.includes("unique")
            ? "Ya existe un producto con ese código."
            : msg;
          toast.error("No se pudo crear el producto", { description });
        },
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !guardando) {
      form.reset(VALORES_INICIALES);
      onCerrar();
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {esEdicion ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? `Modificando: ${productoEditando?.codigo_producto}`
              : "Completa los datos para agregar el producto al catálogo."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="form-producto"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* Código y Nombre */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="codigo_producto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="PROD-001"
                        disabled={guardando || esEdicion}
                        className={`font-mono uppercase ${esEdicion ? "bg-muted/40" : ""}`}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    {esEdicion && (
                      <FormDescription>El código no puede modificarse</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Colchón doble" disabled={guardando} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Descripción opcional del producto…"
                      disabled={guardando}
                      className="resize-none"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Precios */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="precio_contado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio contado (COP) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="350000"
                          disabled={guardando}
                          className="pl-6"
                        />
                      </div>
                    </FormControl>
                    {field.value && !isNaN(Number(field.value)) && Number(field.value) > 0 && (
                      <FormDescription>
                        {formatearMoneda(Number(field.value))}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="precio_credito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio crédito (COP) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="420000"
                          disabled={guardando}
                          className="pl-6"
                        />
                      </div>
                    </FormControl>
                    {field.value && !isNaN(Number(field.value)) && Number(field.value) > 0 && (
                      <FormDescription>
                        {formatearMoneda(Number(field.value))}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Stock y Estado */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="stock_disponible"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock disponible</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Warehouse className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="0"
                          disabled={guardando}
                          className="pl-8"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {esEdicion && (
                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={guardando}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Activo">Activo</SelectItem>
                          <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </form>
        </Form>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-producto"
            disabled={guardando}
            className="min-w-[130px]"
          >
            {guardando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : esEdicion ? (
              <>
                <Edit3 className="mr-2 h-4 w-4" />
                Guardar cambios
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Agregar producto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EstadoVacio({
  buscando,
  onNuevo,
}: {
  buscando: boolean;
  onNuevo: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <PackageSearch className="h-8 w-8" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {buscando ? "Sin resultados" : "Catálogo vacío"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {buscando
            ? "Prueba con otro nombre o código."
            : "Agrega el primer producto para comenzar."}
        </p>
      </div>
      {!buscando && (
        <Button size="sm" onClick={onNuevo}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar producto
        </Button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonFila() {
  return (
    <TableRow>
      {[80, 180, 100, 100, 50, 80, 32].map((w, i) => (
        <TableCell key={i} className={i >= 2 && i <= 4 ? "text-right" : ""}>
          <Skeleton style={{ width: w, height: 16 }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── StatChip ─────────────────────────────────────────────────────────────────

type ChipColor = "default" | "emerald" | "red";

const CHIP_COLORS: Record<ChipColor, string> = {
  default: "bg-muted text-muted-foreground",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function StatChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: ChipColor;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${CHIP_COLORS[color]}`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
