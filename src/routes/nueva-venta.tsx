import { useState, useEffect, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Info,
  Percent,
} from "lucide-react";

import { listarClientes } from "@/services/cliente.service";
import { listarProductos, formatearMoneda } from "@/services/producto.service";
import { procesarVenta, type CarritoItem } from "@/services/ventaService";
import { supabase } from "@/lib/supabase";

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

// Tipo de Venta según reglas comerciales
type TipoVentaComercial =
  | "Contado"
  | "Credito Tradicional"
  | "Credicontado Estandar"
  | "Credicontado 3 Meses";

// Funciones auxiliares para fechas
function obtenerFechaFutura(dias: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dias);
  return date.toISOString().split("T")[0];
}

function obtenerFechaFuturaMeses(meses: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + meses);
  return date.toISOString().split("T")[0];
}

function formatearFechaEspanol(fechaStr: string | null): string {
  if (!fechaStr) return "";
  const partes = fechaStr.split("-");
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function NuevaVenta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ─── Consultas de datos ──────────────────────────────────────────────────
  const { data: clientes = [], isLoading: cargandoClientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: listarClientes,
  });

  const { data: productos = [], isLoading: cargandoProductos } = useQuery({
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

  // Tipo de venta comercial del formulario
  const [tipoVenta, setTipoVenta] = useState<TipoVentaComercial>("Contado");

  // Cuota inicial sugerida / ingresada
  const [cuotaInicial, setCuotaInicial] = useState<number>(0);

  // Frecuencia de pago seleccionada por el usuario (Semanal, Quincenal, Mensual)
  const [frecuenciaPago, setFrecuenciaPago] = useState<"Semanal" | "Quincenal" | "Mensual">("Quincenal");

  // Estados para Refinanciación
  const [creditoActivo, setCreditoActivo] = useState<{ id: string; saldo_pendiente: number; } | null>(null);
  const [isRefinanciacion, setIsRefinanciacion] = useState(false);
  const [openRefinanciacionDialog, setOpenRefinanciacionDialog] = useState(false);

  // Consultar saldo si el cliente cambia
  useEffect(() => {
    if (!selectedClienteId) {
      setCreditoActivo(null);
      setIsRefinanciacion(false);
      return;
    }

    async function checkCredito() {
      const { data, error } = await supabase
        .from("creditos")
        .select("id, saldo_pendiente")
        .eq("cliente_id", selectedClienteId)
        .in("estado", ["Al día", "Próximo a vencer", "Atrasado", "En mora"])
        .order("fecha_venta", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setCreditoActivo({ id: data[0].id, saldo_pendiente: Number(data[0].saldo_pendiente) });
        setOpenRefinanciacionDialog(true);
      } else {
        setCreditoActivo(null);
        setIsRefinanciacion(false);
      }
    }

    checkCredito();
  }, [selectedClienteId]);

  // Cliente seleccionado actual
  const clienteActual = (clientes || []).find((c) => c.id === selectedClienteId);
  // Producto seleccionado actual
  const productoActual = (productos || []).find((p) => p.id === selectedProductoId);

  // ─── Motor de Reglas Comerciales (Reactivo) ──────────────────────────────
  const calculosFinancieros = useMemo(() => {
    const saldoAnterior = isRefinanciacion && creditoActivo ? creditoActivo.saldo_pendiente : 0;

    // Total Base dependiendo del Tipo de Venta
    const sumatoriaProductos = carrito.reduce((acc, item) => {
      const precioUnitario = tipoVenta === "Credito Tradicional" ? item.precioCredito : item.precioContado;
      return acc + item.cantidad * precioUnitario;
    }, 0);

    const totalBase = sumatoriaProductos + saldoAnterior;

    let totalVenta = totalBase;
    let recargoPct = 0;
    let numeroCuotas = 0;
    let fechaProximoPago: string | null = null;
    let fechaFinalEstimada: string | null = null;
    let planExplicacion = "";

    if (tipoVenta === "Contado") {
      totalVenta = totalBase;
      planExplicacion = "Venta de contado. Se cancela la totalidad de la factura al momento de la entrega.";
    } else if (tipoVenta === "Credito Tradicional") {
      if (totalBase <= 1000000) {
        // Rangos quincenales base
        let cuotaQuincenalBase = 20000;
        if (totalBase <= 120000) cuotaQuincenalBase = 20000;
        else if (totalBase <= 250000) cuotaQuincenalBase = 25000;
        else if (totalBase <= 400000) cuotaQuincenalBase = 30000;
        else if (totalBase <= 600000) cuotaQuincenalBase = 40000;
        else cuotaQuincenalBase = 50000;

        // Ajuste de la cuota según frecuencia
        let cuotaFija = cuotaQuincenalBase;
        if (frecuenciaPago === "Semanal") {
          cuotaFija = Math.round(cuotaQuincenalBase / 2);
        } else if (frecuenciaPago === "Mensual") {
          cuotaFija = cuotaQuincenalBase * 2;
        }

        const saldoFinanciar = Math.max(0, totalBase - cuotaInicial);
        numeroCuotas = cuotaFija > 0 ? Math.ceil(saldoFinanciar / cuotaFija) : 0;

        if (numeroCuotas > 0) {
          if (frecuenciaPago === "Semanal") {
            fechaProximoPago = obtenerFechaFutura(7);
            fechaFinalEstimada = obtenerFechaFutura(7 * numeroCuotas);
          } else if (frecuenciaPago === "Quincenal") {
            fechaProximoPago = obtenerFechaFutura(15);
            fechaFinalEstimada = obtenerFechaFutura(15 * numeroCuotas);
          } else {
            fechaProximoPago = obtenerFechaFuturaMeses(1);
            fechaFinalEstimada = obtenerFechaFuturaMeses(numeroCuotas);
          }
        }

        planExplicacion = `Crédito Tradicional. Frecuencia: ${frecuenciaPago}. Cuota fija de ${formatearMoneda(cuotaFija)} calculada automáticamente en base al monto.`;
      } else {
        // Mayor a 1.000.000: Plazo fijo adaptado a la frecuencia
        if (frecuenciaPago === "Mensual") {
          numeroCuotas = 10;
        } else if (frecuenciaPago === "Quincenal") {
          numeroCuotas = 20;
        } else {
          numeroCuotas = 40;
        }

        if (frecuenciaPago === "Semanal") {
          fechaProximoPago = obtenerFechaFutura(7);
          fechaFinalEstimada = obtenerFechaFutura(7 * numeroCuotas);
        } else if (frecuenciaPago === "Quincenal") {
          fechaProximoPago = obtenerFechaFutura(15);
          fechaFinalEstimada = obtenerFechaFutura(15 * numeroCuotas);
        } else {
          fechaProximoPago = obtenerFechaFuturaMeses(1);
          fechaFinalEstimada = obtenerFechaFuturaMeses(10);
        }

        planExplicacion = `Crédito Tradicional Fijo (Compra > $1.000.000). Proyectado a ${numeroCuotas} cuotas ${frecuenciaPago === "Mensual" ? "mensuales" : frecuenciaPago === "Quincenal" ? "quincenales" : "semanales"}.`;
      }
    } else if (tipoVenta === "Credicontado Estandar") {
      totalVenta = totalBase;
      
      let plazoDias = 20;
      if (totalBase <= 100000) plazoDias = 20;
      else if (totalBase <= 200000) plazoDias = 30;
      else if (totalBase <= 500000) plazoDias = 45;
      else plazoDias = 60;

      let pasoDias = 15;
      if (frecuenciaPago === "Semanal") pasoDias = 7;
      else if (frecuenciaPago === "Quincenal") pasoDias = 15;
      else pasoDias = 30;

      numeroCuotas = Math.ceil(plazoDias / pasoDias);

      fechaProximoPago = obtenerFechaFutura(pasoDias);
      fechaFinalEstimada = obtenerFechaFutura(plazoDias);

      planExplicacion = `Credicontado Estándar a 0% de interés. Plazo de ${plazoDias} días amortizado en ${numeroCuotas} cuotas ${frecuenciaPago === "Mensual" ? "mensuales" : frecuenciaPago === "Quincenal" ? "quincenales" : "semanales"}. Fecha límite: ${formatearFechaEspanol(fechaFinalEstimada)}.`;
    } else if (tipoVenta === "Credicontado 3 Meses") {
      // Recargos
      if (totalBase < 500000) recargoPct = 10;
      else if (totalBase < 1000000) recargoPct = 10;
      else if (totalBase < 1500000) recargoPct = 8;
      else if (totalBase < 2500000) recargoPct = 7;
      else recargoPct = 6;

      const recargoMonto = (totalBase * recargoPct) / 100;
      totalVenta = totalBase + recargoMonto;

      if (frecuenciaPago === "Mensual") {
        numeroCuotas = 3;
        fechaProximoPago = obtenerFechaFuturaMeses(1);
        fechaFinalEstimada = obtenerFechaFuturaMeses(3);
      } else if (frecuenciaPago === "Quincenal") {
        numeroCuotas = 6;
        fechaProximoPago = obtenerFechaFutura(15);
        fechaFinalEstimada = obtenerFechaFutura(15 * numeroCuotas);
      } else {
        numeroCuotas = 12;
        fechaProximoPago = obtenerFechaFutura(7);
        fechaFinalEstimada = obtenerFechaFutura(7 * numeroCuotas);
      }

      planExplicacion = `Credicontado a 3 meses. Aplica un recargo del ${recargoPct}% por financiamiento (${formatearMoneda(recargoMonto)}). Proyectado a ${numeroCuotas} cuotas ${frecuenciaPago === "Mensual" ? "mensuales" : frecuenciaPago === "Quincenal" ? "quincenales" : "semanales"}.`;
    }

    const saldoPendiente = tipoVenta === "Contado" ? 0 : Math.max(0, totalVenta - cuotaInicial);

    // Aplicar lógica de redondeo y remanentes
    let valorCuota = 0;
    let ultimaCuota = 0;

    if (tipoVenta !== "Contado" && numeroCuotas > 0) {
      if (numeroCuotas === 1) {
        valorCuota = saldoPendiente;
        ultimaCuota = saldoPendiente;
      } else {
        if (tipoVenta === "Credito Tradicional" && totalBase <= 1000000) {
          // Matriz rígida de cuotas quincenales base
          let cuotaQuincenalBase = 20000;
          if (totalBase <= 120000) cuotaQuincenalBase = 20000;
          else if (totalBase <= 250000) cuotaQuincenalBase = 25000;
          else if (totalBase <= 400000) cuotaQuincenalBase = 30000;
          else if (totalBase <= 600000) cuotaQuincenalBase = 40000;
          else cuotaQuincenalBase = 50000;

          let cuotaFija = cuotaQuincenalBase;
          if (frecuenciaPago === "Semanal") {
            cuotaFija = Math.round(cuotaQuincenalBase / 2);
          } else if (frecuenciaPago === "Mensual") {
            cuotaFija = cuotaQuincenalBase * 2;
          }
          
          valorCuota = cuotaFija;
        } else {
          // División dinámica para Crédito Tradicional (> 1M), Credicontado 3 Meses y Credicontado Estándar
          const cuotaBase = saldoPendiente / numeroCuotas;
          valorCuota = Math.ceil(cuotaBase / 1000) * 1000;
        }
        
        ultimaCuota = saldoPendiente - (valorCuota * (numeroCuotas - 1));
      }
    }

    return {
      totalBase,
      totalVenta,
      recargoPct,
      numeroCuotas,
      valorCuota,
      ultimaCuota,
      frecuenciaPago: tipoVenta === "Contado" ? null : frecuenciaPago,
      fechaProximoPago,
      fechaFinalEstimada,
      saldoPendiente,
      planExplicacion,
    };
  }, [carrito, tipoVenta, cuotaInicial, frecuenciaPago]);

  // Ajustar cuota inicial si supera el nuevo total
  useEffect(() => {
    if (cuotaInicial > calculosFinancieros.totalVenta) {
      setCuotaInicial(calculosFinancieros.totalVenta);
    }
  }, [calculosFinancieros.totalVenta, cuotaInicial]);

  // ─── Acciones del Carrito ────────────────────────────────────────────────
  const agregarAlCarrito = () => {
    if (!selectedProductoId) {
      toast.error("Seleccione un producto");
      return;
    }

    const prod = (productos || []).find((p) => p.id === selectedProductoId);
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

  // ─── Mutación de Procesamiento de Venta ──────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedClienteId) {
        throw new Error("Debe seleccionar un cliente");
      }
      if (carrito.length === 0) {
        throw new Error("El carrito está vacío");
      }
      if (tipoVenta !== "Contado" && tipoVenta !== "Credicontado Estandar" && calculosFinancieros.numeroCuotas <= 0) {
        throw new Error("El número de cuotas calculado debe ser mayor a 0");
      }

      // Convertir el carrito al formato de detalles_venta aplicando los recargos
      const carritoFormateado: CarritoItem[] = carrito.map((item) => {
        let precioAplicado = tipoVenta === "Credito Tradicional" ? item.precioCredito : item.precioContado;
        if (calculosFinancieros.recargoPct > 0) {
          precioAplicado = Math.round(item.precioContado * (1 + calculosFinancieros.recargoPct / 100));
        }
        return {
          productoId: item.productoId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioAplicado: precioAplicado,
          subtotal: item.cantidad * precioAplicado,
        };
      });

      return procesarVenta({
        clienteId: selectedClienteId,
        tipoVenta: tipoVenta === "Contado" ? "Contado" : "Credito", // Enlace estricto a DDL 'Contado' | 'Credito'
        valorContado: calculosFinancieros.totalBase,
        valorCredito: calculosFinancieros.totalVenta,
        cuotaInicial: tipoVenta === "Contado" ? 0 : cuotaInicial,
        saldoPendiente: calculosFinancieros.saldoPendiente,
        numeroCuotas: calculosFinancieros.numeroCuotas,
        valorCuota: calculosFinancieros.valorCuota,
        frecuenciaPago: calculosFinancieros.frecuenciaPago,
        carrito: carritoFormateado,
        fechaProximoPago: calculosFinancieros.fechaProximoPago,
        fechaFinalEstimada: calculosFinancieros.fechaFinalEstimada,
        isRefinanciacion: isRefinanciacion,
        creditoIdRefinanciar: isRefinanciacion && creditoActivo ? creditoActivo.id : undefined,
        saldoAnteriorRefinanciado: isRefinanciacion && creditoActivo ? creditoActivo.saldo_pendiente : 0,
      });
    },
    onSuccess: (res) => {
      toast.success(`🎉 Venta registrada correctamente. Factura: ${res.numeroFactura}`);
      queryClient.invalidateQueries({ queryKey: ["kpis-dashboard"] });
      // Limpiar formulario
      setSelectedClienteId("");
      setCarrito([]);
      setTipoVenta("Contado");
      setCuotaInicial(0);
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
      subtitle="Registrar transacciones de contado u originar nuevos créditos con reglas comerciales"
    >
      <AlertDialog open={openRefinanciacionDialog} onOpenChange={setOpenRefinanciacionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Atención: Refinanciación de Crédito
            </AlertDialogTitle>
            <AlertDialogDescription>
              El cliente <strong>{clienteActual?.nombres} {clienteActual?.apellidos}</strong> ya tiene un crédito activo con un saldo pendiente de <strong>{formatearMoneda(creditoActivo?.saldo_pendiente || 0)}</strong>.
              <br /><br />
              Si continúas, la nueva venta se sumará a esta deuda y el plan de pagos se recalculará (Refinanciación). ¿Deseas realizar una refinanciación?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedClienteId("");
              setIsRefinanciacion(false);
            }}>
              Cancelar y Limpiar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIsRefinanciacion(true);
            }}>
              Aceptar y Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* COLUMNA IZQUIERDA Y CENTRAL: Selección de Cliente y Carrito */}
        <div className="space-y-6 lg:col-span-2">
          {/* SECCIÓN 1: SELECCIÓN DE CLIENTE */}
          <Card className="border-border/60 shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <User className="h-5 w-5" />
                <CardTitle className="text-lg">Selección de Cliente</CardTitle>
              </div>
              <CardDescription>
                Busque y asocie el cliente de la base de datos para registrar la venta.
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
                          {(clientes || []).map((cliente) => (
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
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse font-semibold"
                              : clienteActual.estado === "Judicial"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold"
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
                      <span className="truncate block">
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

          {/* SECCIÓN 2: CARRITO DE COMPRAS */}
          <Card className="border-border/60 shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <ShoppingCart className="h-5 w-5" />
                <CardTitle className="text-lg">Carrito de Compras</CardTitle>
              </div>
              <CardDescription>
                Añada productos al carrito para calcular en tiempo real el Total Base.
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
                            {(productos || [])
                              .filter((p) => p.estado === "Activo")
                              .map((prod) => (
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
                                      Precio Contado: {formatearMoneda(prod.precio_contado)} | Crédito:{" "}
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
                <div className="flex items-center gap-4 rounded-lg bg-primary/5 p-3 text-sm border border-primary/10 animate-in fade-in duration-200">
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
                    <span className="text-base font-bold text-muted-foreground line-through">
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
                      <TableHead className="text-right w-36">Precio Unit. ({tipoVenta === "Credito Tradicional" ? "Crédito" : "Contado"})</TableHead>
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
                        const precioUnitario = tipoVenta === "Credito Tradicional" ? item.precioCredito : item.precioContado;
                        const subtotalItem = item.cantidad * precioUnitario;

                        return (
                          <TableRow key={item.productoId} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-medium">{item.nombre}</TableCell>
                            <TableCell className="text-center">{item.cantidad}</TableCell>
                            <TableCell className="text-right">{formatearMoneda(precioUnitario)}</TableCell>
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

              {/* Resumen de totales */}
              {carrito.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-4 border border-border/50">
                  {isRefinanciacion && creditoActivo && (
                    <div className="flex justify-between items-center text-amber-600 mb-1">
                      <span className="text-sm font-semibold">Saldo Anterior (Refinanciación):</span>
                      <span className="text-sm font-bold">
                        {formatearMoneda(creditoActivo.saldo_pendiente)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-muted-foreground">{isRefinanciacion ? "Nuevo Total Base" : "Total Base"} ({tipoVenta === "Credito Tradicional" ? "Precio Crédito" : "Precio Contado"}):</span>
                    <span className="text-lg font-bold text-foreground">
                      {formatearMoneda(calculosFinancieros.totalBase)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: SECCIÓN 3: CONFIGURACIÓN FINANCIERA */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm transition-all duration-300 hover:shadow-md lg:sticky lg:top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Coins className="h-5 w-5" />
                <CardTitle className="text-lg">Configuración Financiera</CardTitle>
              </div>
              <CardDescription>
                Seleccione el plan de pago. Las cuotas y fechas se calcularán automáticamente según las políticas del almacén.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Radio Group - Tipo de Venta Comercial */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Tipo de Venta / Plan Financiero</Label>
                <RadioGroup
                  value={tipoVenta}
                  onValueChange={(val) => {
                    setTipoVenta(val as TipoVentaComercial);
                    setCuotaInicial(0); // Resetear cuota inicial al cambiar de plan
                  }}
                  className="grid grid-cols-1 gap-2.5"
                >
                  <div className="relative">
                    <RadioGroupItem value="Contado" id="plan-contado" className="peer sr-only" />
                    <Label
                      htmlFor="plan-contado"
                      className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Contado</span>
                          <span className="text-2xs text-muted-foreground">Pago único inmediato</span>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem value="Credito Tradicional" id="plan-tradicional" className="peer sr-only" />
                    <Label
                      htmlFor="plan-tradicional"
                      className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Crédito Tradicional</span>
                          <span className="text-2xs text-muted-foreground">Cuotas quincenales fijas según monto</span>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem value="Credicontado Estandar" id="plan-estandar" className="peer sr-only" />
                    <Label
                      htmlFor="plan-estandar"
                      className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <Percent className="h-5 w-5 text-amber-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Credicontado Estándar</span>
                          <span className="text-2xs text-muted-foreground">Financiación al 0% con fecha límite</span>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem value="Credicontado 3 Meses" id="plan-3meses" className="peer sr-only" />
                    <Label
                      htmlFor="plan-3meses"
                      className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <Coins className="h-5 w-5 text-purple-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Credicontado 3 Meses</span>
                          <span className="text-2xs text-muted-foreground">Plazo a 3 meses con recargo inicial</span>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Input de Cuota Inicial (solo visible para tipos de crédito) */}
              {tipoVenta !== "Contado" && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label htmlFor="cuota-inicial" className="text-sm font-medium">
                    Cuota Inicial (Abono previo)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input
                      id="cuota-inicial"
                      type="number"
                      min={0}
                      max={calculosFinancieros.totalVenta}
                      value={cuotaInicial || ""}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        if (val > calculosFinancieros.totalVenta) {
                          toast.error("La cuota inicial no puede superar el total de la venta");
                          setCuotaInicial(calculosFinancieros.totalVenta);
                        } else {
                          setCuotaInicial(val);
                        }
                      }}
                      className="pl-7"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Selector de Frecuencia de Pago (obligatorio para Créditos) */}
              {tipoVenta !== "Contado" && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label htmlFor="frecuencia-pago-select" className="text-sm font-medium">
                    Frecuencia de Pago <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={frecuenciaPago}
                    onValueChange={(val) => setFrecuenciaPago(val as any)}
                  >
                    <SelectTrigger id="frecuencia-pago-select">
                      <SelectValue placeholder="Seleccione frecuencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semanal">Semanal (cada 7 días)</SelectItem>
                      <SelectItem value="Quincenal">Quincenal (cada 15 días)</SelectItem>
                      <SelectItem value="Mensual">Mensual (cada mes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Banners dinámicos explicativos del motor de reglas */}
              {carrito.length > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3.5 space-y-2.5 animate-in fade-in duration-300">
                  <div className="flex items-start gap-2.5 text-primary">
                    <Info className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider">Regla Aplicada</h4>
                      <p className="text-xs leading-relaxed text-foreground/90">
                        {calculosFinancieros.planExplicacion}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumen del Plan Financiero */}
              <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Total Venta:</span>
                  <span className="text-base font-bold text-foreground">
                    {formatearMoneda(calculosFinancieros.totalVenta)}
                  </span>
                </div>
                {tipoVenta !== "Contado" && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Cuota Inicial:</span>
                      <span className="font-semibold text-foreground">
                        {formatearMoneda(cuotaInicial)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Saldo Pendiente:</span>
                      <span className="font-bold text-foreground">
                        {formatearMoneda(calculosFinancieros.saldoPendiente)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Número de Cuotas:</span>
                      <span className="font-semibold text-foreground">
                        {calculosFinancieros.numeroCuotas || "N/A (Abono Libre)"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Frecuencia:</span>
                      <span className="font-semibold text-foreground">
                        {calculosFinancieros.frecuenciaPago || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Plazo Estimado:</span>
                      <span className="font-semibold text-foreground">
                        {formatearFechaEspanol(calculosFinancieros.fechaFinalEstimada) || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-border/50 pt-3">
                      <span className="text-sm font-semibold text-foreground">Valor Cuota:</span>
                      <span className="text-right">
                        <span className="text-lg font-bold text-primary block">
                          {formatearMoneda(calculosFinancieros.valorCuota)}
                        </span>
                        {calculosFinancieros.numeroCuotas > 1 &&
                          calculosFinancieros.valorCuota !== calculosFinancieros.ultimaCuota && (
                            <span className="text-2xs text-muted-foreground block font-medium">
                              (Última cuota de {formatearMoneda(calculosFinancieros.ultimaCuota)})
                            </span>
                          )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Advertencia si falta cliente o carrito */}
              {(!selectedClienteId || carrito.length === 0) && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 p-3 border border-amber-500/20 text-amber-600 text-xs leading-normal">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Requisitos pendientes:</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {!selectedClienteId && <li>Seleccionar un cliente</li>}
                      {carrito.length === 0 && <li>Agregar al menos 1 producto al carrito</li>}
                    </ul>
                  </div>
                </div>
              )}

              {/* Botón Confirmar Venta */}
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
