import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Lock,
} from "lucide-react";

import { importarCreditos, type CreditoMigracionInput } from "@/services/migracionService";
import { formatearMoneda } from "@/services/producto.service";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/migracion")({
  head: () => ({ meta: [{ title: "Migración de Cartera — Mercacrédito" }] }),
  component: MigracionCartera,
});

interface FilaValidada {
  datos: any;
  errores: string[];
  esValida: boolean;
}

function MigracionCartera() {
  // ─── Control de Rol (Seguridad) ───────────────────────────────────────
  const { perfil } = useAuth();
  const userRole = perfil?.rol || "Vendedor";
  const queryClient = useQueryClient();

  // ─── Estados de Carga y Previsualización ──────────────────────────────
  const [nombreArchivo, setNombreArchivo] = useState<string>("");
  const [filasValidadas, setFilasValidadas] = useState<FilaValidada[]>([]);
  const [estaArrastrando, setEstaArrastrando] = useState<boolean>(false);

  // ─── Estados del Progreso de Importación ──────────────────────────────
  const [importando, setImportando] = useState<boolean>(false);
  const [progresoActual, setProgresoActual] = useState<number>(0);
  const [progresoTotal, setProgresoTotal] = useState<number>(0);

  // ─── Validación de Filas ──────────────────────────────────────────────
  const validarFila = (row: any, index: number): FilaValidada => {
    const errores: string[] = [];

    const cedula = row.cedula_cliente?.toString().trim();
    const nombres = row.nombres?.toString().trim();
    const apellidos = row.apellidos?.toString().trim();
    const telefono = row.telefono?.toString().trim();
    const barrio = row.barrio?.toString().trim();
    const codigoRuta = row.codigo_ruta?.toString().trim();


    if (!nombres) errores.push("Nombres está vacío.");
    if (!apellidos) errores.push("Apellidos está vacío.");
    if (!telefono) errores.push("Teléfono está vacío.");
    if (!barrio) errores.push("Barrio está vacío.");
    if (!codigoRuta) errores.push("Código de ruta está vacío.");

    const numeroCartera = row["# de cartera"]?.toString().trim() || row.numero_cartera?.toString().trim();

    const valOriginal = parseFloat(row.valor_original_credito);
    const saldoPendiente = parseFloat(row.saldo_pendiente_actual);
    const valorCuota = parseFloat(row.valor_cuota);

    if (isNaN(valOriginal) || valOriginal <= 0) {
      errores.push("Valor original debe ser un número mayor a 0.");
    }
    if (isNaN(saldoPendiente) || saldoPendiente < 0) {
      errores.push("Saldo pendiente debe ser igual o mayor a 0.");
    }
    if (isNaN(valorCuota) || valorCuota <= 0) {
      errores.push("Valor de cuota debe ser un número mayor a 0.");
    }

    if (!isNaN(valOriginal) && !isNaN(saldoPendiente) && saldoPendiente > valOriginal) {
      errores.push("El saldo pendiente no puede superar el valor original.");
    }

    const frec = row.frecuencia_pago?.toString().trim();
    let frecuenciaNormalizada: "Semanal" | "Quincenal" | "Mensual" = "Quincenal";
    if (!frec) {
      errores.push("Frecuencia de pago está vacía.");
    } else {
      const frecLower = frec.toLowerCase();
      if (frecLower === "semanal") frecuenciaNormalizada = "Semanal";
      else if (frecLower === "quincenal") frecuenciaNormalizada = "Quincenal";
      else if (frecLower === "mensual") frecuenciaNormalizada = "Mensual";
      else {
        errores.push("Frecuencia inválida (use: Semanal, Quincenal, Mensual).");
      }
    }

    const fechaProximo = row.fecha_proximo_pago?.toString().trim();
    if (!fechaProximo) {
      errores.push("Fecha próximo pago está vacía.");
    } else {
      const dateReg = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateReg.test(fechaProximo)) {
        errores.push("Fecha debe tener formato YYYY-MM-DD.");
      } else {
        const parsedDate = Date.parse(fechaProximo);
        if (isNaN(parsedDate)) {
          errores.push("Fecha de próximo pago es inválida.");
        }
      }
    }

    return {
      datos: {
        cedula_cliente: cedula || "",
        nombres: nombres || "",
        apellidos: apellidos || "",
        telefono: telefono || "",
        barrio: barrio || "",
        valor_original_credito: isNaN(valOriginal) ? 0 : valOriginal,
        saldo_pendiente_actual: isNaN(saldoPendiente) ? 0 : saldoPendiente,
        valor_cuota: isNaN(valorCuota) ? 0 : valorCuota,
        frecuencia_pago: frecuenciaNormalizada,
        fecha_proximo_pago: fechaProximo || "",
        codigo_ruta: codigoRuta || "",
        numero_cartera: numeroCartera || "",
      },
      errores,
      esValida: errores.length === 0,
    };
  };

  // ─── Procesar Archivo Cargado ──────────────────────────────────────────
  const procesarArchivo = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast.error("Por favor, suba únicamente archivos con formato CSV.");
      return;
    }

    setNombreArchivo(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validadas = results.data.map((row, index) => validarFila(row, index));
        setFilasValidadas(validadas);
        toast.success(`Archivo procesado. ${validadas.length} filas leídas.`);
      },
      error: (err) => {
        toast.error(`Error al leer el archivo CSV: ${err.message}`);
      },
    });
  };

  const cargarDatosPrueba = () => {
    const csvContent =
      "cedula_cliente,nombres,apellidos,telefono,barrio,valor_original_credito,saldo_pendiente_actual,valor_cuota,frecuencia_pago,fecha_proximo_pago,codigo_ruta,# de cartera\n" +
      "1056784999,Pedro Julio,Alvarez,3114002233,Muzo Centro,1200000,900000,50000,Quincenal,2026-07-15,NOR,CART-01\n" +
      "1056784998,Maria Helena,Restrepo,3123004455,,400000,-10000,20000,Semanal,2026-07-10,SUR,CART-02";
      
    setNombreArchivo("sample_migration.csv");
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validadas = results.data.map((row, index) => validarFila(row, index));
        setFilasValidadas(validadas);
        toast.success("Datos de prueba cargados con éxito.");
      },
    });
  };

  // ─── Arrastrar y Soltar (Handlers) ─────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setEstaArrastrando(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setEstaArrastrando(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setEstaArrastrando(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      procesarArchivo(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      procesarArchivo(e.target.files[0]);
    }
  };

  const limpiarCarga = () => {
    setNombreArchivo("");
    setFilasValidadas([]);
    setProgresoActual(0);
    setProgresoTotal(0);
  };

  // ─── Descargar Plantilla CSV ───────────────────────────────────────────
  const descargarPlantilla = () => {
    const headers = "cedula_cliente,nombres,apellidos,telefono,barrio,valor_original_credito,saldo_pendiente_actual,valor_cuota,frecuencia_pago,fecha_proximo_pago,codigo_ruta,# de cartera\n";
    const sample1 = "1056784001,Juan Carlos,Ramirez,3156001122,Centro,1000000,850000,50000,Quincenal,2026-07-15,NOR,CART-01\n";
    const sample2 = "43890200,Luz Marina,Zapata,3125556677,La Playa,600000,450000,30000,Semanal,2026-07-10,SUR,CART-02\n";

    const blob = new Blob([headers + sample1 + sample2], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_migracion_mercacredito.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Iniciar Importación Masiva ────────────────────────────────────────
  const handleIniciarImportacion = async () => {
    const validas = filasValidadas.filter(f => f.esValida).map(f => f.datos as CreditoMigracionInput);
    if (validas.length === 0) {
      toast.error("No hay registros válidos para importar.");
      return;
    }

    setImportando(true);
    setProgresoActual(0);
    setProgresoTotal(validas.length);

    try {
      const res = await importarCreditos(validas, (actual, total) => {
        setProgresoActual(actual);
      });

      if (res.fallidos === 0) {
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        toast.success(`🎉 Importación completada. ${res.exitosos} créditos creados con éxito.`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        toast.warning(`Importación terminada con detalles: ${res.exitosos} exitosos, ${res.fallidos} fallidos.`, {
          description: `Errores detallados:\n${res.errores.slice(0, 3).join("\n")}`,
          duration: 7000,
        });
      }
      limpiarCarga();
    } catch (e: any) {
      toast.error(`Error crítico durante la importación: ${e.message || e}`);
    } finally {
      setImportando(false);
    }
  };

  // ─── Filtrado de filas ────────────────────────────────────────────────
  const totalFilas = filasValidadas.length;
  const filasConError = filasValidadas.filter(f => !f.esValida);
  const totalValidas = totalFilas - filasConError.length;

  const progresoPorcentaje = progresoTotal > 0 ? Math.round((progresoActual / progresoTotal) * 100) : 0;

  // ─── Bloque de Acceso Denegado (Seguridad por Rol) ──────────────────────
  if (userRole !== "Administrador") {
    return (
      <AppShell title="Migración de Cartera" subtitle="Importación de saldos iniciales de clientes">

        <Card className="border-border/60 shadow-sm max-w-xl mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Acceso Restringido</CardTitle>
            <CardDescription>
              Esta pantalla está limitada exclusivamente a usuarios con el rol de **Administrador**.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tu rol actual es **{userRole}**. Si necesitas importar saldos iniciales de cartera, solicita accesos de administrador al equipo técnico.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Migración de Cartera" subtitle="Importación masiva de saldos iniciales y créditos activos desde archivos CSV">


      <div className="grid grid-cols-1 gap-6">
        {/* TARJETA DE SUBIDA Y CARGA */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
            <div>
              <CardTitle className="text-lg">Carga de Plantilla Logística</CardTitle>
              <CardDescription>
                Suba el archivo CSV con los créditos a migrar. Recuerde usar el formato y la cabecera exacta de la plantilla.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cargarDatosPrueba}
                className="gap-2 shrink-0 active:scale-[0.98] transition-all bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                id="test-load-mock-csv"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Cargar Datos de Prueba
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={descargarPlantilla}
                className="gap-2 shrink-0 active:scale-[0.98] transition-all"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Area */}
            {!nombreArchivo ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer ${
                  estaArrastrando
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/10"
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="csv-file-input"
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Arrastre el CSV de migración aquí o haga clic para buscar</p>
                    <p className="text-xs text-muted-foreground">Solo archivos de tipo .csv (codificado en UTF-8)</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{nombreArchivo}</span>
                    <span className="text-xs text-muted-foreground">
                      Leídos: {totalFilas} registros | Válidos: {totalValidas} | Errores: {filasConError.length}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={limpiarCarga}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9"
                  disabled={importando}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Barra de progreso de importación */}
            {importando && (
              <div className="space-y-2 rounded-lg bg-muted/40 p-4 border border-border animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Importando créditos a Supabase...</span>
                  <span>{progresoActual} de {progresoTotal} ({progresoPorcentaje}%)</span>
                </div>
                <Progress value={progresoPorcentaje} className="h-2.5" />
              </div>
            )}

            {/* Acciones principales */}
            {nombreArchivo && !importando && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={limpiarCarga}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleIniciarImportacion}
                  disabled={totalValidas === 0}
                  className="gap-2 active:scale-[0.98] transition-all"
                >
                  <CheckCircle className="h-4 w-4" />
                  Iniciar Importación ({totalValidas} créditos)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PREVISUALIZACIÓN DE TABLA Y VALIDACIÓN */}
        {filasValidadas.length > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Previsualización de Datos</CardTitle>
              <CardDescription>
                Revise la validación de cada registro. Las filas con errores no serán importadas en el lote.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-16 text-center">Estado</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right">Valor Cuota</TableHead>
                      <TableHead className="text-center">Frecuencia</TableHead>
                      <TableHead className="text-center">Fecha Pago</TableHead>
                      <TableHead className="text-center">Ruta</TableHead>
                      <TableHead className="text-center">Cartera</TableHead>
                      <TableHead className="w-64">Validación / Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasValidadas.map((fila, index) => {
                      const data = fila.datos;
                      return (
                        <TableRow
                          key={index}
                          className={`hover:bg-muted/10 transition-colors ${
                            !fila.esValida ? "bg-destructive/5 hover:bg-destructive/10" : ""
                          }`}
                        >
                          <TableCell className="text-center">
                            {fila.esValida ? (
                              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                                Válido
                              </Badge>
                            ) : (
                              <Badge className="bg-destructive text-white hover:bg-destructive-hover">
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-xs">{data.cedula_cliente || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {data.nombres || "-"} {data.apellidos || "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatearMoneda(data.valor_original_credito || 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold">
                            {formatearMoneda(data.saldo_pendiente_actual || 0)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatearMoneda(data.valor_cuota || 0)}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {data.frecuencia_pago || "-"}
                          </TableCell>
                          <TableCell className="text-center text-xs whitespace-nowrap">
                            {data.fecha_proximo_pago || "-"}
                          </TableCell>
                          <TableCell className="text-center text-xs font-bold">
                            {data.codigo_ruta || "-"}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {data.numero_cartera || "-"}
                          </TableCell>
                          <TableCell className="text-2xs text-muted-foreground leading-normal max-w-xs">
                            {fila.esValida ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 inline shrink-0" />
                                Campos correctos
                              </span>
                            ) : (
                              <div className="text-destructive font-medium space-y-0.5">
                                {fila.errores.map((err, i) => (
                                  <div key={i} className="flex items-start gap-1">
                                    <AlertTriangle className="h-3 w-3 inline shrink-0 mt-0.5" />
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
