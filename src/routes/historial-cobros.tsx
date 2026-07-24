import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Wallet, Search } from "lucide-react";
import { DateRange } from "react-day-picker";

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
    queryKey: ["historial-cobros", queryStartDate.toISOString(), queryEndDate.toISOString(), cobradorId],
    queryFn: () => obtenerHistorialCobros({
      fechaInicio: queryStartDate,
      fechaFin: queryEndDate,
      cobradorId: isUserAdmin ? cobradorId : perfil?.id, // Seguridad extra
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
  const { totalEfectivo, totalTransferencia, totalGeneral } = useMemo(() => {
    return historialFiltrado.reduce(
      (acc, cobro) => {
        acc.totalGeneral += cobro.valorRecibido;
        if (cobro.metodoPago === "Efectivo") acc.totalEfectivo += cobro.valorRecibido;
        if (cobro.metodoPago === "Transferencia") acc.totalTransferencia += cobro.valorRecibido;
        return acc;
      },
      { totalEfectivo: 0, totalTransferencia: 0, totalGeneral: 0 }
    );
  }, [historialFiltrado]);

  // Manejo de botones de fecha rápida
  const setQuickDate = (dias: number) => {
    setDateRange({
      from: startOfDay(subDays(new Date(), dias)),
      to: endOfDay(new Date()),
    });
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
            <div className="flex items-center gap-2 text-primary">
              <Wallet className="h-5 w-5" />
              <CardTitle className="text-lg">Filtros de Cuadre</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
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
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : historialFiltrado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
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
                      <TableCell colSpan={7} className="p-0">
                        <div className="flex flex-col sm:flex-row items-end justify-between p-4 px-6">
                          <div className="flex items-center gap-6 mb-2 sm:mb-0">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Total Efectivo: </span>
                              <span className="font-bold text-green-600 dark:text-green-400">
                                {formatearMoneda(totalEfectivo)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Total Transferencias: </span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">
                                {formatearMoneda(totalTransferencia)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className="font-bold uppercase text-xs tracking-wider text-muted-foreground">
                              Total Recaudado (Visible)
                            </span>
                            <span className="font-bold text-xl text-indigo-700 dark:text-indigo-400">
                              {formatearMoneda(totalGeneral)}
                            </span>
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
