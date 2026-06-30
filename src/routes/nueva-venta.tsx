import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronsUpDown,
  ShoppingCart,
  Trash2,
  User,
  Plus,
  Coins,
  Loader2,
  Calendar,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

import { listarClientes } from "@/services/cliente.service";
import { listarProductos, formatearMoneda } from "@/services/producto.service";
import { procesarVenta, type CarritoItem } from "@/services/ventaService";

export const Route = createFileRoute("/nueva-venta")({
  head: () => ({ meta: [{ title: "Nueva Venta — Mercacrédito" }] }),
  component: NuevaVenta,
});

// Item interno del carrito en React con ambos precios para la reactividad
interface CarritoReactItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioContado: number;
  precioCredito: number;
}

function NuevaVenta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ─── Consultas de datos ──────────────────────────────────────────────────
  const { data: clientes, isLoading: cargandoClientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: listarClientes,
  });

  const { data: productos, isLoading: cargandoProductos } = useQuery({
    queryKey: ["productos"],
    queryFn: listarProductos,
  });

  // ─── Estados de Formulario / Venta ───────────────────────────────────────
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [openCliente, setOpenCliente] = useState(false);

  const [selectedProductoId, setSelectedProductoId] = useState<string>("");
  const [openProducto, setOpenProducto] = useState(false);
  const [cantidad, setCantidad] = useState<number>(1);
  const [carrito, setCarrito] = useState<CarritoReactItem[]>([]);

  const [tipoVenta, setTipoVenta] = useState<"Contado" | "Credito">("Contado");

  // Parámetros de crédito
  const [cuotaInicial, setCuotaInicial] = useState<number>(0);
  const [numeroCuotas, setNumeroCuotas] = useState<number>(4);
  const [frecuenciaPago, setFrecuenciaPago] = useState<"Semanal" | "Quincenal" | "Mensual">("Semanal");

  // ─── Cálculos reactivos ──────────────────────────────────────────────────
  // Calcular el total general basado en el tipo de venta
  const totalGeneral = carrito.reduce((acc, item) => {
    const precio = tipoVenta === "Credito" ? item.precioCredito : item.precioContado;
    return acc + item.cantidad * precio;
  }, 0);

  // Valor total alternativo para mostrar comparación de ahorro o recargo
  const totalContadoAlternativo = carrito.reduce(
    (acc, item) => acc + item.cantidad * item.precioContado,
    0
  );
  const totalCreditoAlternativo = carrito.reduce(
    (acc, item) => acc + item.cantidad * item.precioCredito,
    0
  );

  // Ajustar cuota inicial si supera el nuevo total
  useEffect(() => {
    if (cuotaInicial > totalGeneral) {
      setCuotaInicial(totalGeneral);
    }
  }, [totalGeneral, cuotaInicial]);

  const saldoPendiente = Math.max(0, totalGeneral - cuotaInicial);
  const valorCuota = numeroCuotas > 0 ? Math.round(saldoPendiente / numeroCuotas) : 0;

  // Cliente seleccionado actual
  const clienteActual = clientes?.find((c) => c.id === selectedClienteId);
  // Producto seleccionado actual
  const productoActual = productos?.find((p) => p.id === selectedProductoId);

  // ─── Acciones ────────────────────────────────────────────────────────────
  const agregarAlCarrito = () => {
    if (!selectedProductoId) {
      toast.error("Seleccione un producto");
      return;
    }

    const prod = productos?.find((p) => p.id === selectedProductoId);
    if (!prod) return;

    if (cantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    // Advertencia de Stock
    if (prod.stock_disponible < cantidad) {
      toast.warning(
        `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock_disponible}. Se agregará de todos modos.`
      );
    }

    setCarrito((prev) => {
      const idx = prev.findIndex((item) => item.productoId === prod.id);
      if (idx > -1) {
        const nuevo = [...prev];
        nuevo[idx].cantidad += cantidad;
        return nuevo;
      } else {
        return [
          ...prev,
          {
            productoId: prod.id,
            nombre: prod.nombre,
            cantidad: cantidad,
            precioContado: prod.precio_contado,
            precioCredito: prod.precio_credito,
          },
        ];
      }
    });

    toast.success(`"${prod.nombre}" agregado al carrito`);
    setSelectedProductoId("");
    setCantidad(1);
  };

  const eliminarDelCarrito = (productoId: string) => {
    setCarrito((prev) => prev.filter((item) => item.productoId !== productoId));
    toast.success("Producto eliminado del carrito");
  };

  // ─── Mutación de Guardado ───────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedClienteId) {
        throw new Error("Debe seleccionar un cliente");
      }
      if (carrito.length === 0) {
        throw new Error("El carrito está vacío");
      }
      if (tipoVenta === "Credito" && numeroCuotas <= 0) {
        throw new Error("El número de cuotas debe ser mayor a 0");
      }

      // Convertir el carrito al formato de ventaService
      const carritoFormateado: CarritoItem[] = carrito.map((item) => {
        const precio = tipoVenta === "Credito" ? item.precioCredito : item.precioContado;
        return {
          productoId: item.productoId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioAplicado: precio,
          subtotal: item.cantidad * precio,
        };
      });

      return procesarVenta({
        clienteId: selectedClienteId,
        tipoVenta,
        valorContado: totalContadoAlternativo,
        valorCredito: totalCreditoAlternativo,
        cuotaInicial: tipoVenta === "Credito" ? cuotaInicial : 0,
        saldoPendiente: tipoVenta === "Credito" ? saldoPendiente : 0,
        numeroCuotas: tipoVenta === "Credito" ? numeroCuotas : 0,
        valorCuota: tipoVenta === "Credito" ? valorCuota : 0,
        frecuenciaPago: tipoVenta === "Credito" ? frecuenciaPago : null,
        carrito: carritoFormateado,
      });
    },
    onSuccess: (res) => {
      toast.success(`🎉 Venta registrada correctamente. Factura: ${res.numeroFactura}`);
      // Invalidar queries relevantes para refrescar KPIs o listas
      queryClient.invalidateQueries({ queryKey: ["kpis-dashboard"] });
      // Limpiar formulario
      setSelectedClienteId("");
      setCarrito([]);
      setTipoVenta("Contado");
      setCuotaInicial(0);
      setNumeroCuotas(4);
      setFrecuenciaPago("Semanal");
      // Redirigir al Dashboard
      navigate({ to: "/" });
    },
    onError: (error: any) => {
      toast.error("Error al procesar la venta", {
        description: error.message || "Ocurrió un error inesperado al insertar los datos.",
      });
    },
  });

  const handleConfirmarVenta = () => {
    mutation.mutate();
  };

  return (
    <AppShell
      title="Nueva Venta"
      subtitle="Registrar transacciones de contado u originar nuevos créditos"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* COLUMNA IZQUIERDA Y CENTRAL: Clientes y Carrito */}
        <div className="space-y-6 lg:col-span-2">
          {/* BLOQUE 1: SELECCIÓN DE CLIENTE */}
          <Card className="border-border/60 shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <User className="h-5 w-5" />
                <CardTitle className="text-lg">Bloque 1: Selección de Cliente</CardTitle>
              </div>
              <CardDescription>
                Busque y seleccione el cliente que realizará la compra.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cliente-select" className="text-sm font-medium">
                  Cliente <span className="text-red-500">*</span>
                </Label>
                <Popover open={openCliente} onOpenChange={setOpenCliente}>
                  <PopoverTrigger asChild>
                    <Button
                      id="cliente-select"
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCliente}
                      className="w-full justify-between font-normal text-left"
                    >
                      {clienteActual
                        ? `[${clienteActual.codigo_consecutivo}] ${clienteActual.nombres} ${clienteActual.apellidos}`
                        : cargandoClientes
                          ? "Cargando clientes..."
                          : "Seleccionar cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 PopoverContent" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Buscar cliente por nombre o cédula..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                        <CommandGroup>
                          {clientes?.map((cliente) => (
                            <CommandItem
                              key={cliente.id}
                              value={`${cliente.nombres} ${cliente.apellidos} ${cliente.cedula} ${cliente.codigo_consecutivo}`}
                              onSelect={() => {
                                setSelectedClienteId(cliente.id);
                                setOpenCliente(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedClienteId === cliente.id ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {cliente.nombres} {cliente.apellidos}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Cédula: {cliente.cedula} | Código: {cliente.codigo_consecutivo}
                                </span>
                              </div>
                              {cliente.estado !== "Activo" && (
                                <Badge
                                  variant="outline"
                                  className="ml-auto text-xs bg-destructive/10 text-destructive border-destructive/20"
                                >
                                  {cliente.estado}
                                </Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Ficha rápida del cliente seleccionado */}
              {clienteActual && (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <span className="block text-xs font-semibold text-muted-foreground uppercase">
                        Código
                      </span>
                      <span className="font-semibold text-foreground">
                        {clienteActual.codigo_consecutivo}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-muted-foreground uppercase">
                        Cédula
                      </span>
                      <span>{clienteActual.cedula}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-muted-foreground uppercase">
                        Estado Financiero
                      </span>
                      <Badge
                        className={`text-xs ${
                          clienteActual.estado === "Activo"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : clienteActual.estado === "Moroso"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : clienteActual.estado === "Judicial"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-neutral-500/10 text-neutral-600 border-neutral-500/20"
                        }`}
                        variant="outline"
                      >
                        {clienteActual.estado}
                      </Badge>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-xs font-semibold text-muted-foreground uppercase">
                        Dirección & Barrio
                      </span>
                      <span>
                        {clienteActual.direccion}, {clienteActual.barrio} ({clienteActual.ciudad})
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-muted-foreground uppercase">
                        Teléfono
                      </span>
                      <span>{clienteActual.telefono_principal}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BLOQUE 2: CARRITO DE COMPRAS */}
          <Card className="border-border/60 shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <ShoppingCart className="h-5 w-5" />
                <CardTitle className="text-lg">Bloque 2: Carrito de Compras</CardTitle>
              </div>
              <CardDescription>
                Busque productos en el catálogo, especifique la cantidad y añádalos a la venta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Controles de Selección e Inserción */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="flex flex-col gap-2 sm:col-span-7">
                  <Label htmlFor="producto-select" className="text-sm font-medium">
                    Producto
                  </Label>
                  <Popover open={openProducto} onOpenChange={setOpenProducto}>
                    <PopoverTrigger asChild>
                      <Button
                        id="producto-select"
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProducto}
                        className="w-full justify-between font-normal text-left"
                      >
                        {productoActual
                          ? `[${productoActual.codigo_producto}] ${productoActual.nombre}`
                          : cargandoProductos
                            ? "Cargando catálogo..."
                            : "Buscar producto por nombre o código..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 PopoverContent" align="start">
                      <Command className="w-full">
                        <CommandInput placeholder="Buscar por nombre o código de producto..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron productos.</CommandEmpty>
                          <CommandGroup>
                            {productos
                              ?.filter((p) => p.estado === "Activo")
                              ?.map((prod) => (
                                <CommandItem
                                  key={prod.id}
                                  value={`${prod.nombre} ${prod.codigo_producto}`}
                                  onSelect={() => {
                                    setSelectedProductoId(prod.id);
                                    setOpenProducto(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedProductoId === prod.id ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium">{prod.nombre}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Contado: {formatearMoneda(prod.precio_contado)} | Crédito:{" "}
                                      {formatearMoneda(prod.precio_credito)}
                                    </span>
                                  </div>
                                  <Badge
                                    variant={prod.stock_disponible > 0 ? "secondary" : "destructive"}
                                    className="ml-auto text-xs"
                                  >
                                    Stock: {prod.stock_disponible}
                                  </Badge>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="cantidad-input" className="text-sm font-medium">
                    Cant.
                  </Label>
                  <Input
                    id="cantidad-input"
                    type="number"
                    min={1}
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                <div className="flex items-end sm:col-span-3">
                  <Button
                    onClick={agregarAlCarrito}
                    type="button"
                    className="w-full gap-2 transition-all active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </div>

              {/* Vista previa de precios del producto seleccionado */}
              {productoActual && (
                <div className="flex items-center gap-4 rounded-lg bg-primary/5 p-3 text-sm text-primary-foreground border border-primary/10 animate-in fade-in duration-200">
                  <div className="flex-1">
                    <span className="block text-xs font-semibold text-primary/70 uppercase">
                      Precio de Contado
                    </span>
                    <span className="text-base font-bold text-primary">
                      {formatearMoneda(productoActual.precio_contado)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <span className="block text-xs font-semibold text-primary/70 uppercase">
                      Precio de Crédito
                    </span>
                    <span className="text-base font-bold text-primary">
                      {formatearMoneda(productoActual.precio_credito)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-primary/70 uppercase text-right">
                      Stock
                    </span>
                    <span className={`font-semibold block text-right ${
                      productoActual.stock_disponible > 0 ? "text-foreground" : "text-destructive"
                    }`}>
                      {productoActual.stock_disponible} uds.
                    </span>
                  </div>
                </div>
              )}

              {/* Tabla de Productos del Carrito */}
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center w-24">Cant.</TableHead>
                      <TableHead className="text-right w-36">Precio Unit.</TableHead>
                      <TableHead className="text-right w-36">Subtotal</TableHead>
                      <TableHead className="text-center w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carrito.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No hay productos en el carrito. Utilice el buscador superior para agregarlos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      carrito.map((item) => {
                        const precio =
                          tipoVenta === "Credito" ? item.precioCredito : item.precioContado;
                        const subtotalItem = item.cantidad * precio;

                        return (
                          <TableRow key={item.productoId} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-medium">{item.nombre}</TableCell>
                            <TableCell className="text-center">{item.cantidad}</TableCell>
                            <TableCell className="text-right">{formatearMoneda(precio)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatearMoneda(subtotalItem)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => eliminarDelCarrito(item.productoId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Resumen e Indicador de Tipo de Venta */}
              {carrito.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-4 border border-border/50">
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Total Contado equivalente:</span>
                    <span>{formatearMoneda(totalContadoAlternativo)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground border-b border-border/50 pb-2">
                    <span>Total Crédito equivalente:</span>
                    <span>{formatearMoneda(totalCreditoAlternativo)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-base font-semibold text-foreground">Total General:</span>
                    <span className="text-xl font-bold text-primary">
                      {formatearMoneda(totalGeneral)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: Condiciones de Pago y Confirmación */}
        <div className="space-y-6">
          {/* BLOQUE 3: CONDICIONES DE PAGO */}
          <Card className="border-border/60 shadow-sm transition-all duration-300 hover:shadow-md lg:sticky lg:top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Coins className="h-5 w-5" />
                <CardTitle className="text-lg">Bloque 3: Condiciones de Pago</CardTitle>
              </div>
              <CardDescription>
                Configure el tipo de pago y la amortización del crédito si aplica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Radio Group - Tipo de Venta */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Tipo de Venta</Label>
                <RadioGroup
                  defaultValue="Contado"
                  value={tipoVenta}
                  onValueChange={(val) => {
                    setTipoVenta(val as "Contado" | "Credito");
                    // Opcional: Resetear cuota inicial si pasa a contado
                    if (val === "Contado") {
                      setCuotaInicial(0);
                    }
                  }}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="Contado" id="contado" className="peer sr-only" />
                    <Label
                      htmlFor="contado"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-200"
                    >
                      <DollarSign className="mb-2 h-6 w-6" />
                      <span className="text-sm font-bold">Contado</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="Credito" id="credito" className="peer sr-only" />
                    <Label
                      htmlFor="credito"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-200"
                    >
                      <Calendar className="mb-2 h-6 w-6" />
                      <span className="text-sm font-bold">Crédito</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Lógica reactiva - Si es Contado */}
              {tipoVenta === "Contado" ? (
                <div className="space-y-4 rounded-lg bg-emerald-500/5 p-4 border border-emerald-500/10 text-emerald-600 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 bg-emerald-500/10 rounded-full p-0.5" />
                    <span className="text-sm font-semibold">Venta de Contado Seleccionada</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase block font-semibold">
                      Total a Pagar
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {formatearMoneda(totalGeneral)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La factura quedará registrada directamente con el estado de pago{" "}
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                      Finalizado
                    </Badge>{" "}
                    al confirmar.
                  </p>
                </div>
              ) : (
                /* Lógica reactiva - Si es Crédito */
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Cuota Inicial */}
                  <div className="space-y-2">
                    <Label htmlFor="cuota-inicial" className="text-sm font-medium">
                      Cuota Inicial
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                      <Input
                        id="cuota-inicial"
                        type="number"
                        min={0}
                        max={totalGeneral}
                        value={cuotaInicial || ""}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          if (val > totalGeneral) {
                            toast.error("La cuota inicial no puede superar el total de la compra");
                            setCuotaInicial(totalGeneral);
                          } else {
                            setCuotaInicial(val);
                          }
                        }}
                        className="pl-7"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Número de Cuotas */}
                  <div className="space-y-2">
                    <Label htmlFor="num-cuotas" className="text-sm font-medium">
                      Número de Cuotas
                    </Label>
                    <Input
                      id="num-cuotas"
                      type="number"
                      min={1}
                      value={numeroCuotas}
                      onChange={(e) => setNumeroCuotas(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  {/* Frecuencia de Pago */}
                  <div className="space-y-2">
                    <Label htmlFor="frecuencia-select" className="text-sm font-medium">
                      Frecuencia de Pago
                    </Label>
                    <Select
                      value={frecuenciaPago}
                      onValueChange={(val) =>
                        setFrecuenciaPago(val as "Semanal" | "Quincenal" | "Mensual")
                      }
                    >
                      <SelectTrigger id="frecuencia-select">
                        <SelectValue placeholder="Seleccione frecuencia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Semanal">Semanal</SelectItem>
                        <SelectItem value="Quincenal">Quincenal</SelectItem>
                        <SelectItem value="Mensual">Mensual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Resultados de Amortización */}
                  <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Saldo Pendiente:</span>
                      <span className="font-bold text-foreground">
                        {formatearMoneda(saldoPendiente)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-border pt-3">
                      <span className="text-muted-foreground font-semibold">Valor de la Cuota:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatearMoneda(valorCuota)}
                      </span>
                    </div>
                  </div>

                  {/* Advertencia si no hay cliente o productos */}
                  {(!selectedClienteId || carrito.length === 0) && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 border border-amber-500/20 text-amber-600 text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <div>
                        Para confirmar la venta, debe completar los bloques obligatorios:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {!selectedClienteId && <li>Seleccionar un cliente</li>}
                          {carrito.length === 0 && <li>Agregar productos al carrito</li>}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botón de Confirmación */}
              <Button
                onClick={handleConfirmarVenta}
                disabled={!selectedClienteId || carrito.length === 0 || mutation.isPending}
                className="w-full text-sm font-semibold h-11 transition-all active:scale-[0.98]"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando Venta...
                  </>
                ) : (
                  "Confirmar Venta"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
