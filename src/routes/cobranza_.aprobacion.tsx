import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  Check,
  X,
  CheckCircle2,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ClipboardCheck,
  FileImage,
  MessageSquareOff,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  obtenerRecaudosPendientes,
  aprobarRecaudo,
  rechazarRecaudo,
  type RecaudoPendiente,
} from "@/services/recaudoService";

// ─── Definición de Ruta ───────────────────────────────────────────────────────

export const Route = createFileRoute("/cobranza_/aprobacion")({
  head: () => ({
    meta: [
      { title: "Aprobación de Recaudos — Mercacrédito" },
      {
        name: "description",
        content: "Bandeja de auditoría y conciliación de cobros de microfinanzas.",
      },
    ],
  }),
  component: AprobacionRecaudosPage,
});

// ─── Utilidades ──────────────────────────────────────────────────────────────

const formatearMoneda = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor);
};

const formatearFecha = (fechaStr: string) => {
  try {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaStr;
  }
};

// ─── Componente Principal ────────────────────────────────────────────────────

function AprobacionRecaudosPage() {
  const queryClient = useQueryClient();

  // Estados para diálogos
  const [fotoSoporteUrl, setFotoSoporteUrl] = useState<string | null>(null);
  const [recaudoARechazar, setRecaudoARechazar] = useState<RecaudoPendiente | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [procesandoAprobacionId, setProcesandoAprobacionId] = useState<string | null>(null);

  // 1. Cargar recaudos pendientes
  const {
    data: recaudos = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["recaudos", "pendientes"],
    queryFn: obtenerRecaudosPendientes,
  });

  // 2. Mutación para Aprobar
  const approveMutation = useMutation({
    mutationFn: (variables: { recaudoId: string; creditoId: string; valorRecibido: number }) =>
      aprobarRecaudo(variables.recaudoId, variables.creditoId, variables.valorRecibido),
    onSuccess: () => {
      toast.success("Recaudo aprobado y saldo descontado con éxito");
      queryClient.invalidateQueries({ queryKey: ["recaudos", "pendientes"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aprobar el recaudo");
    },
    onSettled: () => {
      setProcesandoAprobacionId(null);
    },
  });

  // 3. Mutación para Rechazar
  const rejectMutation = useMutation({
    mutationFn: (variables: { recaudoId: string; motivo: string }) =>
      rechazarRecaudo(variables.recaudoId, variables.motivo),
    onSuccess: () => {
      toast.success("Recaudo rechazado");
      queryClient.invalidateQueries({ queryKey: ["recaudos", "pendientes"] });
      cerrarDialogRechazo();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al rechazar el recaudo");
    },
  });

  const handleAprobar = (item: RecaudoPendiente) => {
    if (!item.credito) {
      toast.error("Error: Este recaudo no tiene un crédito asociado válido.");
      return;
    }
    setProcesandoAprobacionId(item.id);
    approveMutation.mutate({
      recaudoId: item.id,
      creditoId: item.credito_id,
      valorRecibido: item.valor_recibido,
    });
  };

  const abrirDialogRechazo = (item: RecaudoPendiente) => {
    setRecaudoARechazar(item);
    setMotivoRechazo("");
  };

  const cerrarDialogRechazo = () => {
    setRecaudoARechazar(null);
    setMotivoRechazo("");
  };

  const handleConfirmarRechazo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaudoARechazar) return;
    if (!motivoRechazo.trim()) {
      toast.error("El motivo de rechazo es obligatorio");
      return;
    }
    rejectMutation.mutate({
      recaudoId: recaudoARechazar.id,
      motivo: motivoRechazo.trim(),
    });
  };

  // Cálculo de KPIs rápidos
  const totalMontoPendiente = recaudos.reduce((sum, item) => sum + item.valor_recibido, 0);
  const promedioMontoPendiente = recaudos.length > 0 ? totalMontoPendiente / recaudos.length : 0;

  const acciones = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => refetch()}
      disabled={isLoading || isRefetching}
      className="gap-2 h-9"
    >
      <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
      <span>Recargar</span>
    </Button>
  );

  return (
    <AppShell
      title="Aprobación de Recaudos"
      subtitle="Bandeja de abonos realizados en campo pendientes de verificación"
      actions={acciones}
    >
      <div className="space-y-6">
        {/* Panel de Estadísticas Rápidas */}
        {!isLoading && !isError && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Recaudos Pendientes
                  </span>
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {recaudos.length}
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                  <Clock className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Monto Total a Conciliar
                  </span>
                  <span className="text-3xl font-bold tracking-tight text-primary">
                    {formatearMoneda(totalMontoPendiente)}
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Promedio de Recaudo
                  </span>
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {formatearMoneda(promedioMontoPendiente)}
                  </span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabla principal de auditoría */}
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-lg">Recaudos por Auditar</CardTitle>
            <CardDescription>
              Verifica las fotos de los comprobantes y abona los saldos correspondientes a cada crédito.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Cargando */}
            {isLoading && (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-medium">
                  Cargando recaudos pendientes...
                </span>
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <p className="text-sm font-semibold text-destructive">
                  No se pudieron cargar los recaudos.
                </p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Reintentar
                </Button>
              </div>
            )}

            {/* Estado Vacío */}
            {!isLoading && !isError && recaudos.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Al día</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    No hay recaudos pendientes por aprobar en este momento.
                  </p>
                </div>
              </div>
            )}

            {/* Tabla de Datos */}
            {!isLoading && !isError && recaudos.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10">
                      <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                      <TableHead>Cobrador</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-[160px]">Factura / Crédito</TableHead>
                      <TableHead className="w-[150px] text-right">Valor Recibido</TableHead>
                      <TableHead className="w-[120px] text-center">Soporte</TableHead>
                      <TableHead className="w-[180px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recaudos.map((item) => (
                      <TableRow
                        key={item.id}
                        className="group transition-colors hover:bg-muted/30"
                      >
                        {/* Fecha */}
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">
                              {formatearFecha(item.fecha_recaudo)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Cobrador */}
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-2">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">
                              {item.cobrador?.nombre_completo || "Desconocido"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Cliente */}
                        <TableCell className="align-middle">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold leading-none text-foreground">
                              {item.credito?.cliente.nombres} {item.credito?.cliente.apellidos}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              C.C. {item.credito?.cliente.cedula}
                            </p>
                          </div>
                        </TableCell>

                        {/* Crédito */}
                        <TableCell className="align-middle">
                          {item.credito ? (
                            <div className="space-y-0.5">
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {item.credito.numero_factura}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                Saldo: {formatearMoneda(item.credito.saldo_pendiente)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-destructive font-medium">Sin crédito</span>
                          )}
                        </TableCell>

                        {/* Valor Recibido */}
                        <TableCell className="align-middle text-right font-bold text-base text-foreground">
                          {formatearMoneda(item.valor_recibido)}
                        </TableCell>

                        {/* Soporte */}
                        <TableCell className="align-middle text-center">
                          {item.soporte_foto_dinero_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFotoSoporteUrl(item.soporte_foto_dinero_url)}
                              className="h-8 px-2 text-xs font-semibold gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary active:bg-primary/10"
                            >
                              <Camera className="h-3.5 w-3.5 shrink-0" />
                              <span>Ver foto</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sin foto</span>
                          )}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={
                                approveMutation.isPending ||
                                rejectMutation.isPending ||
                                procesandoAprobacionId !== null
                              }
                              onClick={() => handleAprobar(item)}
                              title="Aprobar Recaudo"
                              className="h-8 w-8 text-emerald-600 border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
                            >
                              {procesandoAprobacionId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="outline"
                              size="icon"
                              disabled={
                                approveMutation.isPending ||
                                rejectMutation.isPending ||
                                procesandoAprobacionId !== null
                              }
                              onClick={() => abrirDialogRechazo(item)}
                              title="Rechazar Recaudo"
                              className="h-8 w-8 text-rose-600 border-rose-200 bg-rose-50/30 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:border-rose-900/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/40"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para Visualizar Soporte de Foto */}
      <Dialog open={fotoSoporteUrl !== null} onOpenChange={(open) => !open && setFotoSoporteUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              Soporte de Pago Recibido
            </DialogTitle>
            <DialogDescription>
              Comprobante visual del dinero recolectado en campo por el cobrador.
            </DialogDescription>
          </DialogHeader>

          {fotoSoporteUrl && (
            <div className="flex items-center justify-center p-2 border rounded-lg bg-muted/10 overflow-hidden">
              <img
                src={fotoSoporteUrl}
                alt="Comprobante de dinero"
                className="max-h-[450px] w-auto object-contain rounded-md shadow-xs bg-black/5 dark:bg-black/10"
              />
            </div>
          )}

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setFotoSoporteUrl(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Registrar Motivo de Rechazo */}
      <Dialog open={recaudoARechazar !== null} onOpenChange={(open) => !open && cerrarDialogRechazo()}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleConfirmarRechazo} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <MessageSquareOff className="h-5 w-5 shrink-0" />
                Rechazar Recaudo
              </DialogTitle>
              <DialogDescription>
                Por favor, ingresa el motivo o justificación del rechazo del abono de{" "}
                <strong>
                  {formatearMoneda(recaudoARechazar?.valor_recibido || 0)}
                </strong>{" "}
                para el cliente{" "}
                <strong>
                  {recaudoARechazar?.credito?.cliente.nombres}{" "}
                  {recaudoARechazar?.credito?.cliente.apellidos}
                </strong>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor="motivo_rechazo" className="text-xs font-bold text-foreground block">
                Motivo de Rechazo <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="motivo_rechazo"
                rows={4}
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Escribe aquí detalladamente por qué se rechaza este pago (ej. Billete falso, monto no coincide con foto, etc.)..."
                className="resize-none rounded-lg text-sm"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="submit"
                disabled={rejectMutation.isPending}
                className="bg-destructive hover:bg-destructive/95 text-destructive-foreground font-semibold rounded-lg h-10 px-4 flex items-center justify-center gap-2"
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  "Rechazar Recaudo"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={rejectMutation.isPending}
                onClick={cerrarDialogRechazo}
                className="rounded-lg h-10"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
