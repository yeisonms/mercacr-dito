import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, History, Search, Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

import { obtenerHistorialVentas } from "@/services/ventasHistorialService";
import { obtenerUsuarios } from "@/services/usuarioService";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatearMoneda } from "@/services/producto.service";

export const Route = createFileRoute("/historial-ventas")({
  head: () => ({ meta: [{ title: "Historial de Ventas — Mercacrédito" }] }),
  component: HistorialVentasPage,
});

function HistorialVentasPage() {
  const { perfil } = useAuth();
  
  // Por defecto, mostrar los últimos 7 días
  const defaultDateRange: DateRange = {
    from: startOfDay(subDays(new Date(), 7)),
    to: endOfDay(new Date()),
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);
  const [vendedorId, setVendedorId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const isUserAdmin = perfil?.rol === "Administrador" || perfil?.rol === "Gerencia" || perfil?.rol === "Auxiliar";

  // Efecto para forzar el vendedor_id si no es admin
  useEffect(() => {
    if (perfil && !isUserAdmin) {
      setVendedorId(perfil.id);
    }
  }, [perfil, isUserAdmin]);

  // Cargar lista de vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores_historial"],
    queryFn: obtenerUsuarios,
    enabled: isSupabaseConfigured && isUserAdmin,
  });

  // Cargar historial
  const queryStartDate = dateRange?.from || defaultDateRange.from!;
  const queryEndDate = dateRange?.to || queryStartDate;

  const { data: historial = [], isLoading } = useQuery({
    queryKey: ["historial-ventas", queryStartDate.toISOString(), queryEndDate.toISOString(), vendedorId],
    queryFn: () => obtenerHistorialVentas({
      fechaInicio: queryStartDate,
      fechaFin: queryEndDate,
      vendedorId: isUserAdmin ? vendedorId : perfil?.id, // Seguridad extra
    }),
    enabled: isSupabaseConfigured && !!perfil,
  });

  // Filtrado local por buscador
  const historialFiltrado = useMemo(() => {
    if (!searchTerm) return historial;
    const lowerSearch = searchTerm.toLowerCase();
    return historial.filter(
      (venta) =>
        venta.clienteNombres.toLowerCase().includes(lowerSearch) ||
        venta.clienteApellidos.toLowerCase().includes(lowerSearch) ||
        venta.clienteCedula.includes(lowerSearch) ||
        venta.numeroFactura.toLowerCase().includes(lowerSearch)
    );
  }, [historial, searchTerm]);

  // Cálculo de totales sobre los datos actualmente visibles
  const totalFiltrado = useMemo(() => {
    return historialFiltrado.reduce((acc, venta) => acc + venta.valorCredito, 0);
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
      title="Historial de Ventas"
      subtitle="Consulta, filtra y analiza las ventas registradas"
    >
      <div className="space-y-6">
        {/* BARRA DE FILTROS */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary">
              <History className="h-5 w-5" />
              <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
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

              {/* Filtro Vendedor (Solo Admins) */}
              {isUserAdmin && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Vendedor</span>
                  <Select value={vendedorId} onValueChange={setVendedorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los vendedores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vendedores</SelectItem>
                      {vendedores.map((v) => (
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
                    placeholder="Factura, cliente, cédula..."
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
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Factura</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Cliente</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Vendedor</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Tipo Venta</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Total</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : historialFiltrado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No se encontraron ventas para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {historialFiltrado.map((venta) => (
                      <TableRow key={venta.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(venta.fechaVenta), "dd MMM yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{venta.numeroFactura}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {venta.clienteNombres} {venta.clienteApellidos}
                          </div>
                          <div className="text-xs text-muted-foreground">{venta.clienteCedula}</div>
                        </TableCell>
                        <TableCell className="text-sm">{venta.vendedorNombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal bg-blue-50/50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200">
                            {venta.tipoVenta}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatearMoneda(venta.valorCredito)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={venta.estado === "Al día" ? "default" : venta.estado === "Finalizado" ? "secondary" : "destructive"}
                            className={
                              venta.estado === "Al día" 
                                ? "bg-emerald-500 hover:bg-emerald-600" 
                                : venta.estado === "Finalizado"
                                ? "bg-slate-500 hover:bg-slate-600"
                                : ""
                            }
                          >
                            {venta.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={5} className="text-right font-bold uppercase text-xs tracking-wider">
                        Total Sumatoria (Visible)
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg text-indigo-700 dark:text-indigo-400">
                        {formatearMoneda(totalFiltrado)}
                      </TableCell>
                      <TableCell></TableCell>
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
