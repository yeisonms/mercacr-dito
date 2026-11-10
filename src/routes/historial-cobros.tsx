import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Wallet, Search, FileDown, Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { obtenerHistorialCobros } from "@/services/cobrosHistorialService";
import { obtenerUsuarios } from "@/services/usuarioService";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatearMoneda } from "@/services/producto.service";
import { descargarPdfCuadreCaja } from "@/services/cuadrePdfService";

export const Route = createFileRoute("/historial-cobros")({
  head: () => ({ meta: [{ title: "Cuadre de Caja — Mercacrédito" }] }),
  component: HistorialCobrosPage,
});

function HistorialCobrosPage() {
  const { perfil } = useAuth();
  
  // Por defecto, mostrar únicamente el día de hoy
  const defaultDateRange: DateRange = {
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);
  const [cobradorId, setCobradorId] = useState<string>("all");
  const [origenFiltro, setOrigenFiltro] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const isUserAdmin = perfil?.rol === "Administrador" || perfil?.rol === "Gerencia" || perfil?.rol === "Auxiliar";

  // Efecto para forzar el cobrador_id si no es admin
  useEffect(() => {
    if (perfil && !isUserAdmin) {
      setCobradorId(perfil.id);
    }
  }, [perfil, isUserAdmin]);

  // Cargar lista de cobradores
  const { data: cobradores = [] } = useQuery({
    queryKey: ["cobradores_historial"],
    queryFn: obtenerUsuarios,
    enabled: isSupabaseConfigured && isUserAdmin,
  });

  // Cargar historial
  const queryStartDate = dateRange?.from || defaultDateRange.from!;
  const queryEndDate = dateRange?.to || queryStartDate;

  const { data: historial = [], isLoading } = useQuery({
    queryKey: ["historial-cobros", queryStartDate.toISOString(), queryEndDate.toISOString(), cobradorId, origenFiltro],
    queryFn: () => obtenerHistorialCobros({
      fechaInicio: queryStartDate,
      fechaFin: queryEndDate,
      cobradorId: isUserAdmin ? cobradorId : perfil?.id, // Seguridad extra
      origenPago: origenFiltro !== "all" ? origenFiltro : undefined,
    }),
    enabled: isSupabaseConfigured && !!perfil,
  });

  // Filtrado local por buscador
  const historialFiltrado = useMemo(() => {
    if (!searchTerm) return historial;
    const lowerSearch = searchTerm.toLowerCase();
    return historial.filter(
      (cobro) =>
        cobro.clienteNombres.toLowerCase().includes(lowerSearch) ||
        cobro.clienteApellidos.toLowerCase().includes(lowerSearch) ||
        cobro.clienteCedula.includes(lowerSearch) ||
        cobro.numeroFactura.toLowerCase().includes(lowerSearch)
    );
  }, [historial, searchTerm]);

  // Cálculo de totales sobre los datos actualmente visibles
  const { totalEfectivoRuta, totalTransferenciaRuta, totalAlmacen, totalCuotaInicial, totalGeneral, totalEfectivo, totalTransferencia } = useMemo(() => {
    return historialFiltrado.reduce(
      (acc, cobro) => {
        acc.totalGeneral += cobro.valorRecibido;
        if (cobro.metodoPago === "Efectivo") acc.totalEfectivo += cobro.valorRecibido;
        if (cobro.metodoPago === "Transferencia") acc.totalTransferencia += cobro.valorRecibido;

        if (cobro.origenPago === "Ruta") {
          if (cobro.metodoPago === "Efectivo") {
            acc.totalEfectivoRuta += cobro.valorRecibido;
          } else {
            acc.totalTransferenciaRuta += cobro.valorRecibido;
          }
        } else if (cobro.origenPago === "Almacen") {
          acc.totalAlmacen += cobro.valorRecibido;
        } else if (cobro.origenPago === "CuotaInicial") {
          acc.totalCuotaInicial += cobro.valorRecibido;
        }
        return acc;
      },
      { 
        totalEfectivoRuta: 0, 
        totalTransferenciaRuta: 0, 
        totalAlmacen: 0, 
        totalCuotaInicial: 0, 
        totalGeneral: 0,
        totalEfectivo: 0,
        totalTransferencia: 0 
      }
    );
  }, [historialFiltrado]);

  // Manejo de botones de fecha rápida
  const setQuickDate = (dias: number) => {
    setDateRange({
      from: startOfDay(subDays(new Date(), dias)),
      to: endOfDay(new Date()),
    });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleDescargarPDF = async () => {
    if (historialFiltrado.length === 0) {
      toast.error("No hay recaudos para exportar con los filtros seleccionados");
      return;
    }

    try {
      setIsExporting(true);
      toast.loading("Generando reporte PDF...", { id: "descarga-cuadre-pdf" });

      // Formatear texto del rango de fechas
      let rangoFechasTexto = "Todas las fechas";
      if (dateRange?.from) {
        if (dateRange.to) {
          rangoFechasTexto = `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`;
        } else {
          rangoFechasTexto = format(dateRange.from, "dd/MM/yyyy");
        }
      }

      // Formatear texto del cobrador
      let cobradorTexto = "Todos los cobradores";
      if (cobradorId !== "all") {
        const cobradorEncontrado = cobradores.find((c) => c.id === cobradorId);
        cobradorTexto = cobradorEncontrado?.nombre_completo || perfil?.nombre_completo || "Cobrador seleccionado";
      } else if (!isUserAdmin && perfil) {
        cobradorTexto = perfil.nombre_completo || "Cobrador actual";
      }

      await descargarPdfCuadreCaja({
        cobros: historialFiltrado,
        rangoFechasTexto,
        cobradorTexto,
        busquedaTexto: searchTerm.trim() || undefined,
        usuarioGenerador: perfil?.nombre_completo || "Usuario",
        rolUsuario: perfil?.rol || "",
        totalEfectivo,
        totalTransferencia,
        totalGeneral,
        totalEfectivoRuta,
        totalAlmacen,
      });

      toast.success("PDF generado y descargado correctamente", { id: "descarga-cuadre-pdf" });
    } catch (error) {
      console.error("Error al generar PDF de cuadre:", error);
      toast.error("Ocurrió un error al generar el archivo PDF", { id: "descarga-cuadre-pdf" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      title="Cuadre de Caja (Historial)"
      subtitle="Consulta, filtra y concilia los recaudos ingresados al sistema"
    >
      <div className="space-y-6">
        {/* BARRA DE FILTROS */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-primary">
                <Wallet className="h-5 w-5" />
                <CardTitle className="text-lg">Filtros de Cuadre</CardTitle>
              </div>
              <Button
                onClick={handleDescargarPDF}
                disabled={isLoading || historialFiltrado.length === 0 || isExporting}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-all"
                size="sm"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generando PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    <span>Descargar PDF ({historialFiltrado.length})</span>
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Filtro Rango de Fechas */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Rango de Fechas</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                            {format(dateRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Seleccionar fechas</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 border-b flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setQuickDate(0)}>Hoy</Button>
                      <Button variant="outline" size="sm" onClick={() => setQuickDate(1)}>Ayer</Button>
                      <Button variant="outline" size="sm" onClick={() => setQuickDate(7)}>Últimos 7 días</Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        const now = new Date();
                        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                      }}>Este Mes</Button>
                    </div>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filtro Cobrador (Solo Admins) */}
              {isUserAdmin && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Cobrador</span>
                  <Select value={cobradorId} onValueChange={setCobradorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los cobradores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los cobradores</SelectItem>
                      {cobradores.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nombre_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filtro Origen de Recaudo */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Origen del Recaudo</span>
                <Select value={origenFiltro} onValueChange={setOrigenFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los orígenes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los orígenes</SelectItem>
                    <SelectItem value="Ruta">Ruta (Cobro en calle / Cobrador)</SelectItem>
                    <SelectItem value="Almacen">Almacén / Oficina (Caja central)</SelectItem>
                    <SelectItem value="CuotaInicial">Cuota Inicial (Al crear venta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Buscador de Texto */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Buscador</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Cliente, cédula, factura..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* TABLA DE RESULTADOS */}
        <Card className="border-border/60 shadow-sm">
          <div className="rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Fecha</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Cliente</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Factura</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Cobrador</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-center">Origen</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Método</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Recaudo</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : historialFiltrado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      No se encontraron cobros para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {historialFiltrado.map((cobro) => (
                      <TableRow key={cobro.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(cobro.fechaRecaudo), "dd MMM yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {cobro.clienteNombres} {cobro.clienteApellidos}
                          </div>
                          <div className="text-xs text-muted-foreground">{cobro.clienteCedula}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{cobro.numeroFactura}</TableCell>
                        <TableCell className="text-sm">{cobro.cobradorNombre}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={
                              cobro.origenPago === "Almacen"
                                ? "bg-blue-50/70 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200"
                                : cobro.origenPago === "CuotaInicial"
                                ? "bg-amber-50/70 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200"
                                : "bg-emerald-50/70 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200"
                            }
                          >
                            {cobro.origenPago === "Almacen" ? "Almacén" : cobro.origenPago === "CuotaInicial" ? "Cuota Inicial" : "Ruta"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              cobro.metodoPago === "Efectivo"
                                ? "bg-green-50/50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200"
                                : "bg-purple-50/50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200"
                            }
                          >
                            {cobro.metodoPago}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatearMoneda(cobro.valorRecibido)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline"
                            className={
                              cobro.estado === "Aprobado" 
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                                : cobro.estado === "Pendiente"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-red-500/10 text-red-600 border-red-500/20"
                            }
                          >
                            {cobro.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={8} className="p-0">
                        <div className="flex flex-col lg:flex-row items-end justify-between p-4 px-6 gap-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                            <div className="text-xs border rounded-lg p-2.5 bg-emerald-500/5 border-emerald-500/20">
                              <span className="text-muted-foreground block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                                Efectivo Ruta (A entregar)
                              </span>
                              <span className="font-extrabold text-base text-emerald-700 dark:text-emerald-400">
                                {formatearMoneda(totalEfectivoRuta)}
                              </span>
                            </div>
                            <div className="text-xs border rounded-lg p-2.5 bg-blue-500/5 border-blue-500/20">
                              <span className="text-muted-foreground block text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400">
                                Pagos en Almacén (Caja Central)
                              </span>
                              <span className="font-extrabold text-base text-blue-700 dark:text-blue-400">
                                {formatearMoneda(totalAlmacen)}
                              </span>
                            </div>
                            <div className="text-xs border rounded-lg p-2.5 bg-purple-500/5 border-purple-500/20">
                              <span className="text-muted-foreground block text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400">
                                Transferencias en Ruta
                              </span>
                              <span className="font-extrabold text-base text-purple-700 dark:text-purple-400">
                                {formatearMoneda(totalTransferenciaRuta)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div className="text-right flex items-center gap-3">
                              <span className="font-bold uppercase text-xs tracking-wider text-muted-foreground">
                                Total Recaudado (Visible)
                              </span>
                              <span className="font-bold text-xl text-indigo-700 dark:text-indigo-400">
                                {formatearMoneda(totalGeneral)}
                              </span>
                            </div>
                            <Button
                              onClick={handleDescargarPDF}
                              disabled={isLoading || historialFiltrado.length === 0 || isExporting}
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950 font-medium"
                            >
                              <FileDown className="h-4 w-4" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
