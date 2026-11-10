import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  User,
  Banknote,
  Calendar,
  Check,
  ChevronsUpDown,
  History,
  FileSpreadsheet,
  Phone,
  MapPin,
  ClipboardList,
  Clock,
  Loader2,
  CalendarClock,
  AlertTriangle,
  Pencil,
  Trash2,
  Receipt,
  MoreVertical,
  ShoppingBag,
  Package,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { obtenerHistorialGestiones } from "@/services/gestionService";
import { useAuth } from "@/context/AuthContext";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  buscarClientesParaEstadoCuenta,
  obtenerEstadoCuenta,
  aplicarPenalidadCredicontado,
  type ProductoVendidoDetalle,
} from "@/services/estadoCuentaService";
import { formatearMoneda } from "@/services/producto.service";
import { ModalPago } from "@/components/pago/ModalPago";
import {
  ComprobanteReciboModal,
  type ReciboData,
} from "@/components/pago/ComprobanteReciboModal";
import { ModalCorregirRecaudo } from "@/components/pago/ModalCorregirRecaudo";
import { ModalAnularRecaudo } from "@/components/pago/ModalAnularRecaudo";
import { ModalDevolucionProducto } from "@/components/pago/ModalDevolucionProducto";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/estado-cuenta")({
  head: () => ({
    meta: [
      { title: "Estado de Cuenta — Mercacrédito" },
      {
        name: "description",
        content: "Consulta el plan de pagos y el historial de recaudos de cada cliente en tiempo real.",
      },
    ],
  }),
  component: EstadoCuentaPage,
});

function formatearFechaLocal(fechaStr: string | null): string {
  if (!fechaStr) return "-";
  const partes = fechaStr.split("T")[0].split("-");
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearFechaHora(timestampStr: string | null): string {
  if (!timestampStr) return "-";
  const date = new Date(timestampStr);
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EstadoCuentaPage() {
  const { perfil } = useAuth();
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [openCliente, setOpenCliente] = useState(false);
  const [isModalPagoOpen, setIsModalPagoOpen] = useState(false);
  const [dialogPenalidadOpen, setDialogPenalidadOpen] = useState(false);
  const [creditoAPenalizar, setCreditoAPenalizar] = useState<string | null>(null);

  // Estados para Devolución al Almacén
  const [modalDevolucionOpen, setModalDevolucionOpen] = useState(false);
  const [itemADevolver, setItemADevolver] = useState<ProductoVendidoDetalle | null>(null);

  const queryClient = useQueryClient();

  const mutationPenalidad = useMutation({
    mutationFn: aplicarPenalidadCredicontado,
    onSuccess: () => {
      toast.success("Penalidad aplicada correctamente", {
        description: "El saldo de contado ha sido eliminado y el crédito ahora tiene el valor original.",
      });
      setDialogPenalidadOpen(false);
      setCreditoAPenalizar(null);
      queryClient.invalidateQueries({ queryKey: ["estado-cuenta", selectedClienteId] });
      queryClient.invalidateQueries({ queryKey: ["creditosCobro"] }); // Refrescar cobranza
    },
    onError: (err: any) => {
      toast.error("Error al aplicar la penalidad", {
        description: err.message,
      });
    },
  });

  const handleAplicarPenalidad = (creditoId: string) => {
    setCreditoAPenalizar(creditoId);
    setDialogPenalidadOpen(true);
  };

  // Query para cargar la lista de clientes del buscador
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes-busqueda-estado-cuenta", perfil?.id],
    queryFn: () => buscarClientesParaEstadoCuenta(perfil?.rol === "Cobrador" ? perfil.id : undefined),
    enabled: !!perfil,
  });

  // Query para cargar el estado de cuenta del cliente seleccionado
  const {
    data: estadoCuenta,
    isLoading: loadingEstado,
    isError: errorEstado,
    error: errorEstadoObj,
  } = useQuery({
    queryKey: ["estado-cuenta", selectedClienteId],
    queryFn: () => obtenerEstadoCuenta(selectedClienteId),
    enabled: !!selectedClienteId,
    retry: 1,
  });

  // Query para el Historial de Gestiones
  const {
    data: gestiones = [],
    isLoading: isLoadingGestiones,
    error: errorGestiones,
  } = useQuery({
    queryKey: ["gestiones", selectedClienteId],
    queryFn: () => obtenerHistorialGestiones(selectedClienteId),
    enabled: !!selectedClienteId,
  });

  // Cliente seleccionado actual en el combo
  const clienteSeleccionado = clientes.find(c => c.id === selectedClienteId);

  // Estados para corrección, anulación y visualización de recibos
  const [reciboParaVer, setReciboParaVer] = useState<ReciboData | null>(null);
  const [isModalReciboOpen, setIsModalReciboOpen] = useState(false);

  const [recaudoACorregir, setRecaudoACorregir] = useState<any | null>(null);
  const [isModalCorregirOpen, setIsModalCorregirOpen] = useState(false);

  const [recaudoAAnular, setRecaudoAAnular] = useState<any | null>(null);
  const [isModalAnularOpen, setIsModalAnularOpen] = useState(false);

  const handleVerRecibo = (r: any) => {
    if (!estadoCuenta?.cliente || !estadoCuenta?.credito) return;
    const recibo: ReciboData = {
      fecha: formatearFechaHora(r.fecha),
      clienteNombre: `${estadoCuenta.cliente.nombres} ${estadoCuenta.cliente.apellidos}`,
      abono: r.valorRecibido,
      totalCredito: estadoCuenta.credito.valorCredito,
      saldoPendiente: estadoCuenta.credito.saldoPendiente,
      telefono: estadoCuenta.cliente.telefono,
      tipoCredito: estadoCuenta.credito.tipoVenta,
      totalCredicontado: estadoCuenta.credito.valorContado,
      saldoCredicontado: estadoCuenta.credito.saldoContado,
      penalidadAplicada: estadoCuenta.credito.penalidadAplicada,
      fechaLimitePago: estadoCuenta.credito.fechaLimiteCredicontado,
      numeroFactura: estadoCuenta.credito.numeroFactura,
      cobradorNombre: r.cobrador,
      esCorregido: (r.observaciones || "").includes("[CORRECCIÓN"),
    };
    setReciboParaVer(recibo);
    setIsModalReciboOpen(true);
  };

  const handleSuccessCorreccion = (res: {
    recaudoId: string;
    nuevoValor: number;
    nuevoSaldoPendiente: number;
    nuevoSaldoContado: number | null;
  }) => {
    queryClient.invalidateQueries({ queryKey: ["estado-cuenta", selectedClienteId] });
    queryClient.invalidateQueries({ queryKey: ["creditosCobro"] });
    queryClient.invalidateQueries({ queryKey: ["kpis-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reporte-comisiones"] });

    if (estadoCuenta?.cliente && estadoCuenta?.credito) {
      const reciboActualizado: ReciboData = {
        fecha: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
        clienteNombre: `${estadoCuenta.cliente.nombres} ${estadoCuenta.cliente.apellidos}`,
        abono: res.nuevoValor,
        totalCredito: estadoCuenta.credito.valorCredito,
        saldoPendiente: res.nuevoSaldoPendiente,
        telefono: estadoCuenta.cliente.telefono,
        tipoCredito: estadoCuenta.credito.tipoVenta,
        totalCredicontado: estadoCuenta.credito.valorContado,
        saldoCredicontado: res.nuevoSaldoContado,
        penalidadAplicada: estadoCuenta.credito.penalidadAplicada,
        fechaLimitePago: estadoCuenta.credito.fechaLimiteCredicontado,
        numeroFactura: estadoCuenta.credito.numeroFactura,
        esCorregido: true,
      };
      setReciboParaVer(reciboActualizado);
      setIsModalReciboOpen(true);
    }
  };

  const handleSuccessAnulacion = () => {
    queryClient.invalidateQueries({ queryKey: ["estado-cuenta", selectedClienteId] });
    queryClient.invalidateQueries({ queryKey: ["creditosCobro"] });
    queryClient.invalidateQueries({ queryKey: ["kpis-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reporte-comisiones"] });
  };

  return (
    <AppShell
      title="Estado de Cuenta"
      subtitle="Visualiza amortizaciones de cuotas e historial de cobros por cliente"
    >
      <div className="space-y-6">
        {/* BUSCADOR PRINCIPAL DE CLIENTES */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Buscador de Clientes</CardTitle>
            <CardDescription>
              Selecciona un cliente por su nombre o número de cédula para consultar sus saldos e historial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Popover open={openCliente} onOpenChange={setOpenCliente}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCliente}
                    className="w-full justify-between font-normal text-left h-10 border-border/80"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>
                        {clienteSeleccionado
                          ? `[${clienteSeleccionado.codigo_consecutivo}${clienteSeleccionado.numero_cartera ? ` - ${clienteSeleccionado.numero_cartera}` : ""}] ${clienteSeleccionado.nombres} ${clienteSeleccionado.apellidos}`
                          : loadingClientes
                            ? "Cargando clientes..."
                            : "Seleccionar cliente..."}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] sm:w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nombres, apellidos o cédula..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      <CommandGroup>
                        {clientes.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.nombres} ${c.apellidos} ${c.cedula} ${c.codigo_consecutivo} ${c.numero_cartera || ""}`}
                            onSelect={() => {
                              setSelectedClienteId(c.id);
                              setOpenCliente(false);
                            }}
                            className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-semibold text-xs text-foreground">
                                {c.nombres} {c.apellidos}
                              </span>
                              {selectedClienteId === c.id && (
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            <span className="text-3xs text-muted-foreground">
                              Cédula: {c.cedula} | Código: {c.codigo_consecutivo} {c.numero_cartera ? `| # Cartera: ${c.numero_cartera}` : ""}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* SI NO HAY CLIENTE SELECCIONADO */}
        {!selectedClienteId && (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/60 rounded-xl bg-muted/10">
            <ClipboardList className="h-12 w-12 text-muted-foreground/60 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">Consulta de Cuentas</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Busca y selecciona un cliente en el panel superior para cargar su ficha financiera, cuotas activas y cobros físicos registrados.
            </p>
          </div>
        )}

        {/* LOADING SKELETONS */}
        {selectedClienteId && loadingEstado && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Skeleton className="h-44 md:col-span-2 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        )}

        {/* ERROR AL CARGAR */}
        {selectedClienteId && errorEstado && !loadingEstado && (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-rose-500/30 rounded-xl bg-rose-500/5">
            <FileSpreadsheet className="h-10 w-10 text-rose-500/60 mb-3" />
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Error al cargar el estado de cuenta</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {(errorEstadoObj as Error)?.message || "No se pudo obtener la información. Verifica la conexión con Supabase."}
            </p>
            <p className="text-3xs text-muted-foreground mt-3 italic">Revisa la consola del navegador para más detalles.</p>
          </div>
        )}

        {/* DATOS DE ESTADO DE CUENTA */}
        {selectedClienteId && estadoCuenta && !loadingEstado && (
          <div className="space-y-6">
            {/* ENCABEZADO Y RESUMEN FINANCIERO */}
            <div className="grid gap-6 md:grid-cols-12">
              {/* Card 1: Datos Básicos del Cliente */}
              {estadoCuenta.cliente && (
                <Card className="md:col-span-7 border-border/60 shadow-sm hover:shadow-md transition-all">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                          Datos Básicos del Cliente
                        </CardTitle>
                      </div>
                      <h3 className="text-base font-extrabold text-foreground mt-1">
                        {estadoCuenta.cliente.nombres} {estadoCuenta.cliente.apellidos}
                      </h3>
                      <p className="text-3xs text-muted-foreground">
                        Código Consecutivo: <span className="font-bold text-foreground">{estadoCuenta.cliente.codigoConsecutivo}</span>
                      </p>
                    </div>
                    <Badge
                      className={
                        estadoCuenta.cliente.estado === "Activo"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          : estadoCuenta.cliente.estado === "Moroso"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                            : "bg-muted text-muted-foreground"
                      }
                      variant="outline"
                    >
                      {estadoCuenta.cliente.estado}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 text-xs border-t border-border/30 pt-4">
                    <div className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground block text-3xs uppercase font-medium">Cédula de Identidad</span>
                        <span className="font-semibold text-foreground">{estadoCuenta.cliente.cedula}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground block text-3xs uppercase font-medium">Teléfono Principal</span>
                        <span className="font-semibold text-foreground">{estadoCuenta.cliente.telefono}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground block text-3xs uppercase font-medium">Dirección de Domicilio</span>
                        <span className="font-semibold text-foreground">
                          {estadoCuenta.cliente.direccion}, Barrio {estadoCuenta.cliente.barrio} ({estadoCuenta.cliente.ciudad})
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card 2: Mini Resumen del Crédito */}
              <Card className="md:col-span-5 border-border/60 shadow-sm hover:shadow-md transition-all bg-muted/10 flex flex-col justify-between">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary shrink-0" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Crédito Actual
                    </CardTitle>
                  </div>
                  {estadoCuenta?.credito && (
                    <Badge
                      variant="outline"
                      className={
                        estadoCuenta.credito.estado === "Al día" || estadoCuenta.credito.estado === "Activo"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold"
                          : estadoCuenta.credito.estado === "Moroso" || estadoCuenta.credito.estado === "En Mora"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 font-semibold"
                            : estadoCuenta.credito.estado === "Devuelto"
                              ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-semibold"
                              : "bg-muted text-muted-foreground"
                      }
                    >
                      {estadoCuenta.credito.estado}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3.5 pt-4">
                  {estadoCuenta.credito ? (
                    <>
                      {estadoCuenta.credito.estado === "Devuelto" && (
                        <div className="bg-red-100 text-red-800 border border-red-500 rounded-lg p-3 text-sm font-bold text-center uppercase tracking-wide shadow-sm flex items-center justify-center gap-2">
                          <AlertTriangle className="h-5 w-5 shrink-0" />
                          <span>VENTA ANULADA POR DEVOLUCIÓN: {estadoCuenta.credito.motivoDevolucion || 'Sin motivo'}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                        <span className="text-xs text-muted-foreground">Factura N°:</span>
                        <span className="text-xs font-bold text-foreground">{estadoCuenta.credito.numeroFactura}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                        <span className="text-xs text-muted-foreground">Tipo de Crédito:</span>
                        <span className="text-xs font-bold text-foreground">
                          {estadoCuenta.credito.tipoVenta === "Credicontado" ? "Credicontado" : "Crédito Normal"}
                        </span>
                      </div>
                      
                      {estadoCuenta.credito.tipoVenta === "Credicontado" ? (
                        <>
                          <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-xs text-muted-foreground">Total del Crédito:</span>
                            <span className="text-xs font-bold text-foreground">
                              {formatearMoneda(estadoCuenta.credito.valorCredito)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-xs text-muted-foreground">Total Credicontado:</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {formatearMoneda(estadoCuenta.credito.valorContado)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-xs text-muted-foreground font-semibold">Saldo Pendiente:</span>
                            <span className="text-sm font-extrabold text-foreground">
                              {formatearMoneda(estadoCuenta.credito.saldoPendiente)}
                            </span>
                          </div>
                          {!estadoCuenta.credito.penalidadAplicada && estadoCuenta.credito.saldoContado != null && (
                            <>
                              <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                <span className="text-xs text-muted-foreground font-semibold">Saldo Credicontado:</span>
                                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {formatearMoneda(estadoCuenta.credito.saldoContado)}
                                </span>
                              </div>
                              {estadoCuenta.credito.fechaLimiteCredicontado && (
                                <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                  <span className="text-xs text-muted-foreground font-semibold">Límite Beneficio:</span>
                                  <span className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(estadoCuenta.credito.fechaLimiteCredicontado).toLocaleDateString('es-CO', { timeZone: 'UTC' })}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-xs text-muted-foreground">Total del Crédito:</span>
                            <span className="text-xs font-bold text-foreground">
                              {formatearMoneda(estadoCuenta.credito.valorCredito)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="text-xs text-muted-foreground font-semibold">Saldo Pendiente:</span>
                            <span className="text-sm font-extrabold text-primary">
                              {formatearMoneda(estadoCuenta.credito.saldoPendiente)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Próximo Pago:</span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-bold text-foreground">
                            {formatearFechaLocal(estadoCuenta.credito.fechaProximoPago)}
                          </span>
                        </div>
                      </div>

                      {estadoCuenta.credito.tipoVenta === "Credicontado" && !estadoCuenta.credito.penalidadAplicada && (
                        <div className="pt-2">
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="w-full text-xs font-semibold" 
                            onClick={() => handleAplicarPenalidad(estadoCuenta.credito!.id)}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1.5" />
                            Aplicar Penalidad (Incumplimiento)
                          </Button>
                        </div>
                      )}

                      {estadoCuenta.credito.estado !== "Finalizado" && estadoCuenta.credito.estado !== "Cancelado" && estadoCuenta.credito.estado !== "Devuelto" && (
                        <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            onClick={() => setIsModalPagoOpen(true)}
                            className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 gap-1.5 shadow-sm flex-1"
                          >
                            <Banknote className="h-4 w-4 shrink-0" />
                            <span>Registrar Abono Libre</span>
                          </Button>
                          {(perfil?.rol === "Administrador" || perfil?.rol === "Gerencia") && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setItemADevolver(null);
                                setModalDevolucionOpen(true);
                              }}
                              className="h-9 text-xs font-bold px-3 gap-1.5 shadow-sm flex-1"
                            >
                              <RotateCcw className="h-4 w-4 shrink-0" />
                              <span>Anular / Devolver</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      Este cliente no tiene créditos registrados en el sistema.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* PANEL DE TABS PARA AMORTIZACIONES, RECAUDOS Y PRODUCTOS */}
            {estadoCuenta.credito && (
              <Tabs defaultValue="cuotas" className="w-full">
                <TabsList className="grid grid-cols-4 max-w-3xl h-10 border border-border bg-muted/40 p-1">
                  <TabsTrigger value="cuotas" className="text-xs flex items-center justify-center gap-1.5 py-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Plan de Pagos</span>
                    <span className="sm:hidden">Plan</span>
                  </TabsTrigger>
                  <TabsTrigger value="recaudos" className="text-xs flex items-center justify-center gap-1.5 py-1.5">
                    <History className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Historial Recaudos</span>
                    <span className="sm:hidden">Recaudos</span>
                  </TabsTrigger>
                  <TabsTrigger value="productos" className="text-xs flex items-center justify-center gap-1.5 py-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Artículos Llevados</span>
                    <span className="sm:hidden">Artículos</span>
                  </TabsTrigger>
                  <TabsTrigger value="gestiones" className="text-xs flex items-center justify-center gap-1.5 py-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Historial Gestiones</span>
                    <span className="sm:hidden">Gestiones</span>
                  </TabsTrigger>
                </TabsList>

                {/* CONTENIDO PESTAÑA 1: PLAN DE PAGOS (CUOTAS) */}
                <TabsContent value="cuotas" className="mt-4">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Tabla de Amortización</CardTitle>
                      <CardDescription>
                        Desglose detallado de las cuotas programadas, montos cancelados y saldos de cuotas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 sm:pt-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="w-16 text-center">N° Cuota</TableHead>
                              <TableHead>Fecha Vencimiento</TableHead>
                              <TableHead className="text-right">Valor Cuota</TableHead>
                              <TableHead className="text-right">Valor Pagado</TableHead>
                              <TableHead className="text-right">Saldo Cuota</TableHead>
                              <TableHead className="text-center">Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {estadoCuenta.cuotas.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground italic">
                                  No hay plan de pagos disponible para este crédito.
                                </TableCell>
                              </TableRow>
                            ) : (
                              estadoCuenta.cuotas.map((cuota) => (
                                <TableRow key={cuota.id} className="hover:bg-muted/5">
                                  <TableCell className="text-center font-bold text-xs py-3 text-muted-foreground">
                                    {cuota.numeroCuota}
                                  </TableCell>
                                  <TableCell className="py-3 text-xs font-medium text-foreground">
                                    {formatearFechaLocal(cuota.fechaVencimiento)}
                                  </TableCell>
                                  <TableCell className="text-right py-3 text-xs font-semibold text-foreground">
                                    {formatearMoneda(cuota.valorCuota)}
                                  </TableCell>
                                  <TableCell className="text-right py-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {formatearMoneda(cuota.valorPagado)}
                                  </TableCell>
                                  <TableCell className="text-right py-3 text-xs text-foreground font-bold">
                                    {formatearMoneda(cuota.saldoCuota)}
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <Badge
                                      className={
                                        cuota.estado === "Pagada"
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-4xs uppercase font-extrabold"
                                          : cuota.estado === "Parcial"
                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-4xs uppercase font-extrabold"
                                            : cuota.estado === "En Mora"
                                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-4xs uppercase font-extrabold"
                                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-4xs uppercase font-extrabold"
                                      }
                                      variant="outline"
                                    >
                                      {cuota.estado === "En Mora" ? "En Mora" : cuota.estado}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CONTENIDO PESTAÑA 2: HISTORIAL DE RECAUDOS */}
                <TabsContent value="recaudos" className="mt-4">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Pagos y Recaudos Recibidos</CardTitle>
                      <CardDescription>
                        Listado de cobros físicos o pagos registrados en caja para este crédito.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 sm:pt-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead>Fecha Recaudo</TableHead>
                              <TableHead className="text-right">Valor Recibido</TableHead>
                              <TableHead>Cobrador</TableHead>
                              <TableHead>Observaciones</TableHead>
                              <TableHead className="text-center">Estado</TableHead>
                              <TableHead className="text-right pr-4">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {estadoCuenta.recaudos.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground italic">
                                  Aún no se registran recaudos para este crédito.
                                </TableCell>
                              </TableRow>
                            ) : (
                              estadoCuenta.recaudos.map((recaudo) => (
                                <TableRow key={recaudo.id} className="hover:bg-muted/5">
                                  <TableCell className="py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                                    {formatearFechaHora(recaudo.fecha)}
                                  </TableCell>
                                  <TableCell className="text-right py-3 text-xs text-primary font-bold whitespace-nowrap">
                                    {formatearMoneda(recaudo.valorRecibido)}
                                  </TableCell>
                                  <TableCell className="py-3 text-xs font-medium text-foreground whitespace-nowrap">
                                    {recaudo.cobrador}
                                  </TableCell>
                                  <TableCell className="py-3 text-xs text-muted-foreground max-w-xs truncate" title={recaudo.observaciones || ""}>
                                    {recaudo.observaciones || "-"}
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <Badge
                                      className={
                                        recaudo.estado === "Aprobado"
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-4xs uppercase font-extrabold"
                                          : recaudo.estado === "Rechazado"
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-4xs uppercase font-extrabold"
                                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-4xs uppercase font-extrabold"
                                      }
                                      variant="outline"
                                    >
                                      {recaudo.estado}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right py-3 pr-4 whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Botón Ver y reenviar recibo */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground font-medium"
                                        onClick={() => handleVerRecibo(recaudo)}
                                        title="Ver, descargar o enviar recibo por WhatsApp"
                                      >
                                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Recibo</span>
                                      </Button>

                                      {/* Acciones exclusivas para Administrador */}
                                      {perfil?.rol === "Administrador" && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                              title="Opciones de administración"
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuLabel className="text-3xs uppercase tracking-wider text-muted-foreground">
                                              Gestión Admin
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                              className="text-xs cursor-pointer gap-2"
                                              onClick={() => {
                                                setRecaudoACorregir(recaudo);
                                                setIsModalCorregirOpen(true);
                                              }}
                                            >
                                              <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                              Corregir Valor
                                            </DropdownMenuItem>
                                            {recaudo.estado !== "Rechazado" && (
                                              <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  className="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive"
                                                  onClick={() => {
                                                    setRecaudoAAnular(recaudo);
                                                    setIsModalAnularOpen(true);
                                                  }}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                  Anular Pago
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CONTENIDO PESTAÑA 3: HISTORIAL DE ARTÍCULOS Y VENTAS */}
                <TabsContent value="productos" className="mt-4">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-primary" />
                            Historial de Artículos y Ventas
                          </CardTitle>
                          <CardDescription>
                            Detalle de productos adquiridos por el cliente, cantidades y precios que justifican el saldo de la deuda.
                          </CardDescription>
                        </div>
                        {estadoCuenta.productosLlevados && estadoCuenta.productosLlevados.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs py-1">
                              {estadoCuenta.productosLlevados.reduce((acc, item) => acc + item.cantidad, 0)} artículos en total
                            </Badge>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs py-1 font-bold">
                              Total Facturado: {formatearMoneda(estadoCuenta.productosLlevados.reduce((acc, item) => acc + item.subtotal, 0))}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 sm:pt-0">
                      {(!estadoCuenta.productosLlevados || estadoCuenta.productosLlevados.length === 0) ? (
                        <div className="p-8 text-center border-t sm:border border-dashed border-border/60 sm:rounded-xl bg-muted/10 mx-0 sm:mx-0">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mb-3">
                            <Package className="h-6 w-6" />
                          </div>
                          <h4 className="text-sm font-semibold text-foreground">Sin desglose de artículos individuales</h4>
                          <p className="mt-1 text-xs text-muted-foreground max-w-lg mx-auto">
                            Este crédito proviene de la migración inicial de cartera o fue creado como un saldo global de deuda anterior sin inventario ítem por ítem.
                          </p>
                          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-xs">
                            <span className="text-muted-foreground">Valor del Crédito Inicial:</span>
                            <span className="font-bold text-foreground">{formatearMoneda(estadoCuenta.credito.valorCredito)}</span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-muted-foreground">Saldo Pendiente Actual:</span>
                            <span className="font-bold text-primary">{formatearMoneda(estadoCuenta.credito.saldoPendiente)}</span>
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground italic">
                            Las nuevas ventas o refinanciaciones registrarán automáticamente cada producto llevado con su fecha y precio.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-muted/40">
                              <TableRow>
                                <TableHead>Fecha Venta</TableHead>
                                <TableHead>Factura</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Cant.</TableHead>
                                <TableHead className="text-right">Precio Unitario</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                                <TableHead className="text-center">Crédito</TableHead>
                                <TableHead className="text-right pr-4">Acción</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {estadoCuenta.productosLlevados.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/20">
                                  <TableCell className="text-xs font-medium whitespace-nowrap">
                                    {item.fechaVenta ? (
                                      <span className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        {(() => {
                                          try {
                                            return format(new Date(item.fechaVenta), "dd/MM/yyyy", { locale: es });
                                          } catch {
                                            return item.fechaVenta.split("T")[0];
                                          }
                                        })()}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground italic">Sin fecha</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs font-semibold whitespace-nowrap">
                                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] border border-border/50">
                                      {item.numeroFactura}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                    {item.productoCodigo}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium">
                                    <div className="flex items-center gap-2">
                                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="font-semibold text-foreground">{item.productoNombre}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-center font-bold">
                                    <Badge variant="secondary" className="px-2 py-0.5 text-xs font-bold">
                                      {item.cantidad}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-right whitespace-nowrap text-muted-foreground">
                                    {formatearMoneda(item.precioAplicado)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-bold whitespace-nowrap text-foreground">
                                    {formatearMoneda(item.subtotal)}
                                  </TableCell>
                                  <TableCell className="text-center whitespace-nowrap">
                                    <Badge
                                      variant="outline"
                                      className={
                                        item.creditoId === estadoCuenta.credito.id
                                          ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                                          : "bg-muted text-muted-foreground border-border text-[10px]"
                                      }
                                    >
                                      {item.creditoId === estadoCuenta.credito.id ? "Crédito Actual" : item.estadoCredito}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right pr-4 whitespace-nowrap">
                                    {(perfil?.rol === "Administrador" || perfil?.rol === "Gerencia") && estadoCuenta.credito.estado !== "Devuelto" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setItemADevolver(item);
                                          setModalDevolucionOpen(true);
                                        }}
                                        className="h-7 text-[11px] font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        Devolver
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CONTENIDO PESTAÑA 4: HISTORIAL DE GESTIONES */}
                <TabsContent value="gestiones" className="mt-4">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Historial de Visitas y Gestiones
                      </CardTitle>
                      <CardDescription>
                        Registro histórico de promesas de pago, visitas y cobranza en campo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 sm:pt-0">
                      {errorGestiones ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 border-2 border-dashed border-rose-500/30 rounded-xl bg-rose-500/5">
                          <p className="text-sm text-destructive font-bold">Error al cargar gestiones</p>
                          <p className="text-xs text-muted-foreground">{errorGestiones?.message}</p>
                        </div>
                      ) : isLoadingGestiones ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">Cargando gestiones...</p>
                        </div>
                      ) : gestiones.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
                          <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                          No hay gestiones ni visitas registradas aún.
                        </div>
                      ) : (
                        <div className="relative border-l-2 border-primary/20 ml-3 md:ml-6 space-y-8">
                          {gestiones.map((gestion: any) => (
                            <div key={gestion.id} className="relative pl-6 md:pl-8">
                              {/* Indicador de estado */}
                              <div className="absolute w-4 h-4 rounded-full -left-[9px] top-1 bg-primary/20 border-2 border-primary ring-4 ring-background" />
                              
                              <div className="space-y-2">
                                {/* Fecha y Cobrador */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                  <span className="text-sm font-bold text-foreground">
                                    {format(new Date(gestion.fecha_registro), "PPP p", { locale: es })}
                                  </span>
                                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded-md w-fit">
                                    <User className="w-3 h-3" />
                                    {gestion.cobrador?.nombre_completo}
                                  </span>
                                </div>

                                {/* Estado de la Gestión */}
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      gestion.estado_gestion === "Visitado con Pago" 
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" 
                                        : gestion.estado_gestion === "Promesa de Pago" 
                                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                    }
                                  >
                                    {gestion.estado_gestion}
                                  </Badge>
                                  
                                  {/* Si fue pago, mostrar valor */}
                                  {gestion.recaudo && (
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <Banknote className="w-4 h-4" />
                                      + ${gestion.recaudo.valor_recibido?.toLocaleString()}
                                    </span>
                                  )}

                                  {/* Si fue promesa, mostrar la fecha prometida */}
                                  {gestion.promesa && (
                                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                      <CalendarClock className="w-4 h-4" />
                                      Prometido para: {format(new Date(gestion.promesa.fecha_compromiso + "T12:00:00"), "PP", { locale: es })}
                                    </span>
                                  )}
                                </div>

                                {/* Observaciones */}
                                {gestion.observaciones && (
                                  <div className="bg-muted/30 p-3 rounded-lg text-sm text-muted-foreground border border-border/50 shadow-sm">
                                    {gestion.observaciones}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogPenalidadOpen} onOpenChange={setDialogPenalidadOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Aplicar Penalidad
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Estás seguro que deseas aplicar la penalidad por incumplimiento a este crédito de <strong>Credicontado</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2 mt-2 bg-rose-50/50 p-4 rounded-xl border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
            <p>Al aplicar esta penalidad:</p>
            <ul className="list-disc list-inside space-y-1 ml-1 text-rose-700/80 dark:text-rose-400/80">
              <li>El <strong>saldo de contado</strong> será eliminado.</li>
              <li>El cliente deberá pagar el <strong>valor total de crédito</strong>.</li>
              <li>Se calculará la <strong>comisión extra</strong> para el vendedor.</li>
            </ul>
            <p className="font-semibold text-rose-700 dark:text-rose-400 mt-3">Esta acción no se puede deshacer.</p>
          </div>
          <DialogFooter className="mt-4 sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogPenalidadOpen(false)}
              disabled={mutationPenalidad.isPending}
              className="flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => creditoAPenalizar && mutationPenalidad.mutate(creditoAPenalizar)}
              disabled={mutationPenalidad.isPending}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700"
            >
              {mutationPenalidad.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                "Sí, aplicar penalidad"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* MODAL DE DEVOLUCIÓN DE PRODUCTO O ANULACIÓN */}
        {estadoCuenta?.credito && estadoCuenta?.cliente && (
          <ModalDevolucionProducto
            isOpen={modalDevolucionOpen}
            onClose={() => {
              setModalDevolucionOpen(false);
              setItemADevolver(null);
            }}
            creditoId={itemADevolver?.creditoId || estadoCuenta.credito.id}
            clienteId={estadoCuenta.cliente.id}
            clienteNombre={`${estadoCuenta.cliente.nombres} ${estadoCuenta.cliente.apellidos}`}
            usuarioId={perfil?.id || ""}
            itemProducto={itemADevolver}
            productosEnCredito={(estadoCuenta?.productosLlevados || []).filter(
              (p) => p.creditoId === (itemADevolver?.creditoId || estadoCuenta.credito.id)
            )}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["estado-cuenta", selectedClienteId] });
              queryClient.invalidateQueries({ queryKey: ["creditosCobro"] });
              queryClient.invalidateQueries({ queryKey: ["kpis-dashboard"] });
            }}
          />
        )}

        {estadoCuenta?.credito && estadoCuenta?.cliente && (
        <ModalPago 
          isOpen={isModalPagoOpen} 
          onClose={() => setIsModalPagoOpen(false)} 
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["estado-cuenta", selectedClienteId] })}
          creditoSeleccionado={{
            id: estadoCuenta.credito.id,
            saldo_pendiente: estadoCuenta.credito.saldoPendiente,
            valor_credito: estadoCuenta.credito.valorCredito,
            estado: estadoCuenta.credito.estado as any,
            numero_factura: estadoCuenta.credito.numeroFactura,
            tipo_venta: estadoCuenta.credito.tipoVenta,
            valor_contado: estadoCuenta.credito.valorContado,
            saldo_contado: estadoCuenta.credito.saldoContado,
            penalidad_aplicada: estadoCuenta.credito.penalidadAplicada,
            fecha_limite_credicontado: estadoCuenta.credito.fechaLimiteCredicontado,
            cliente: {
              id: estadoCuenta.cliente.id,
              nombres: estadoCuenta.cliente.nombres,
              apellidos: estadoCuenta.cliente.apellidos,
              cedula: estadoCuenta.cliente.cedula,
              telefono_principal: estadoCuenta.cliente.telefono,
              barrio: estadoCuenta.cliente.barrio,
              latitud: null, 
              longitud: null, 
            }
          }}
        />
      )}

      {/* Modal para Visualizar, Descargar y Compartir Recibos */}
      <ComprobanteReciboModal
        isOpen={isModalReciboOpen}
        onClose={() => setIsModalReciboOpen(false)}
        reciboData={reciboParaVer}
      />

      {/* Modal para Corregir Valor de Recaudo (Admin) */}
      {estadoCuenta?.credito && estadoCuenta?.cliente && (
        <ModalCorregirRecaudo
          isOpen={isModalCorregirOpen}
          onClose={() => setIsModalCorregirOpen(false)}
          recaudo={recaudoACorregir}
          credito={{
            id: estadoCuenta.credito.id,
            numeroFactura: estadoCuenta.credito.numeroFactura,
            saldoPendiente: estadoCuenta.credito.saldoPendiente,
            saldoContado: estadoCuenta.credito.saldoContado,
            tipoVenta: estadoCuenta.credito.tipoVenta,
          }}
          clienteNombre={`${estadoCuenta.cliente.nombres} ${estadoCuenta.cliente.apellidos}`}
          onSuccess={handleSuccessCorreccion}
        />
      )}

      {/* Modal para Anular Recaudo (Admin) */}
      {estadoCuenta?.credito && estadoCuenta?.cliente && (
        <ModalAnularRecaudo
          isOpen={isModalAnularOpen}
          onClose={() => setIsModalAnularOpen(false)}
          recaudo={recaudoAAnular}
          credito={{
            id: estadoCuenta.credito.id,
            numeroFactura: estadoCuenta.credito.numeroFactura,
            saldoPendiente: estadoCuenta.credito.saldoPendiente,
            saldoContado: estadoCuenta.credito.saldoContado,
          }}
          clienteNombre={`${estadoCuenta.cliente.nombres} ${estadoCuenta.cliente.apellidos}`}
          onSuccess={handleSuccessAnulacion}
        />
      )}
    </AppShell>
  );
}
