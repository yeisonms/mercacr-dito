import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, FileSpreadsheet, Download } from "lucide-react";
import { utils, writeFile } from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { obtenerReporteComisiones } from "@/services/comisiones.service";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/reportes-comisiones")({
  head: () => ({
    meta: [{ title: "Reporte de Comisiones — Mercacrédito" }],
  }),
  component: ReportesComisionesPage,
});

function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

function ReportesComisionesPage() {
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [anio, setAnio] = useState<number>(new Date().getFullYear());

  const { data: reporte = [], isLoading } = useQuery({
    queryKey: ["reporte-comisiones", mes, anio],
    queryFn: () => obtenerReporteComisiones(mes, anio),
    enabled: isSupabaseConfigured,
  });

  const exportarExcel = () => {
    if (!reporte || reporte.length === 0) {
      toast.error("No hay datos para exportar.");
      return;
    }

    const dataExcel = reporte.map(r => ({
      "Nombre Vendedor": r.nombreVendedor,
      "Cantidad Ventas": r.cantidadVentas,
      "Total Vendido": r.totalVendido,
      "% Comisión": r.porcentajeComision,
      "Comisión a Pagar": r.totalComision,
    }));

    const ws = utils.json_to_sheet(dataExcel);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Comisiones");

    const nombreMes = MESES.find(m => m.value === mes)?.label || "";
    writeFile(wb, `Reporte_Comisiones_${nombreMes}_${anio}.xlsx`);
    toast.success("Excel descargado correctamente.");
  };

  const totalPagar = reporte.reduce((acc, curr) => acc + curr.totalComision, 0);

  return (
    <AppShell
      title="Reporte de Comisiones"
      subtitle="Liquidación de nómina de comisiones por vendedor"
      actions={
        <Button onClick={exportarExcel} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <FileSpreadsheet className="w-4 h-4" />
          Exportar a Excel
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary">
              <Coins className="h-5 w-5" />
              <CardTitle className="text-lg">Filtros de Reporte</CardTitle>
            </div>
            <CardDescription>Selecciona el periodo a consultar.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="w-48">
              <Select value={mes.toString()} onValueChange={(val) => setMes(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Select value={anio.toString()} onValueChange={(val) => setAnio(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <div className="rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold uppercase text-xs tracking-wider">Vendedor</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Ventas</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">Total Vendido</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-right">% Comisión</TableHead>
                  <TableHead className="font-semibold uppercase text-xs tracking-wider text-right text-indigo-700 dark:text-indigo-400">Comisión a Pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : reporte.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No hay comisiones registradas en este periodo.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {reporte.map((r) => (
                      <TableRow key={r.vendedorId}>
                        <TableCell className="font-medium">{r.nombreVendedor}</TableCell>
                        <TableCell className="text-right">{r.cantidadVentas}</TableCell>
                        <TableCell className="text-right">{formatearMoneda(r.totalVendido)}</TableCell>
                        <TableCell className="text-right font-mono">{r.porcentajeComision}%</TableCell>
                        <TableCell className="text-right font-semibold text-indigo-700 dark:text-indigo-400">
                          {formatearMoneda(r.totalComision)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={4} className="text-right font-bold uppercase text-xs tracking-wider">
                        Total Liquidación Nómina
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg text-indigo-700 dark:text-indigo-400">
                        {formatearMoneda(totalPagar)}
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
