import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/services/estadoCuentaService";
import { formatearMoneda } from "@/services/producto.service";

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
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [openCliente, setOpenCliente] = useState(false);

  // Query para cargar la lista de clientes del buscador
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes-busqueda-estado-cuenta"],
    queryFn: buscarClientesParaEstadoCuenta,
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

  // Cliente seleccionado actual en el combo
  const clienteSeleccionado = clientes.find(c => c.id === selectedClienteId);

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
                          ? `[${clienteSeleccionado.codigo_consecutivo}] ${clienteSeleccionado.nombres} ${clienteSeleccionado.apellidos}`
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
                            value={`${c.nombres} ${c.apellidos} ${c.cedula} ${c.codigo_consecutivo}`}
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
                              Cédula: {c.cedula} | Código: {c.codigo_consecutivo}
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
            <div className="grid gap-6 md:grid-cols-3">
              {/* Card 1: Datos Básicos del Cliente */}
              {estadoCuenta.cliente && (
                <Card className="md:col-span-2 border-border/60 shadow-sm hover:shadow-md transition-all">
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
              <Card className="border-border/60 shadow-sm hover:shadow-md transition-all bg-muted/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary shrink-0" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Crédito Actual
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3.5 pt-1.5">
                  {estadoCuenta.credito ? (
                    <>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                        <span className="text-xs text-muted-foreground">Factura N°:</span>
                        <span className="text-xs font-bold text-foreground">{estadoCuenta.credito.numeroFactura}</span>
                      </div>
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
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Próximo Pago:</span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-bold text-foreground">
                            {formatearFechaLocal(estadoCuenta.credito.fechaProximoPago)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      Este cliente no tiene créditos registrados en el sistema.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* PANEL DE TABS PARA AMORTIZACIONES E RECAUDOS */}
            {estadoCuenta.credito && (
              <Tabs defaultValue="cuotas" className="w-full">
                <TabsList className="grid grid-cols-2 max-w-sm h-10 border border-border bg-muted/40 p-1">
                  <TabsTrigger value="cuotas" className="text-xs flex items-center gap-1.5 py-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                    <span>Plan de Pagos (Cuotas)</span>
                  </TabsTrigger>
                  <TabsTrigger value="recaudos" className="text-xs flex items-center gap-1.5 py-1.5">
                    <History className="h-3.5 w-3.5 shrink-0" />
                    <span>Historial de Recaudos</span>
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {estadoCuenta.recaudos.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground italic">
                                  Aún no se registran recaudos para este crédito.
                                </TableCell>
                              </TableRow>
                            ) : (
                              estadoCuenta.recaudos.map((recaudo) => (
                                <TableRow key={recaudo.id} className="hover:bg-muted/5">
                                  <TableCell className="py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                                    {formatearFechaHora(recaudo.fecha)}
                                  </TableCell>
                                  <TableCell className="text-right py-3 text-xs text-primary font-bold">
                                    {formatearMoneda(recaudo.valorRecibido)}
                                  </TableCell>
                                  <TableCell className="py-3 text-xs font-medium text-foreground whitespace-nowrap">
                                    {recaudo.cobrador}
                                  </TableCell>
                                  <TableCell className="py-3 text-xs text-muted-foreground max-w-xs truncate">
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
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
