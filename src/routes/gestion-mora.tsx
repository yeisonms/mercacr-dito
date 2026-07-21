import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, AlertTriangle, Clock, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { obtenerCarteraMorosa, registrarAlertaCobro, aplicarPenalidadIndividual, ClienteMoroso } from "@/services/moraService";
import { obtenerConfiguracion } from "@/services/configuracionService";
import { formatearMoneda } from "@/services/producto.service";

export const Route = createFileRoute("/gestion-mora")({
  component: GestionMoraPage,
});

function determinarSemaforo(diasAtraso: number) {
  if (diasAtraso > 30) return { label: "Crítico", color: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" };
  if (diasAtraso >= 15) return { label: "Alerta", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" };
  return { label: "Preventivo", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" };
}

function GestionMoraPage() {
  const queryClient = useQueryClient();

  const { data: morosos = [], isLoading, isError } = useQuery({
    queryKey: ["cartera-morosa"],
    queryFn: obtenerCarteraMorosa,
  });

  const alertaMutation = useMutation({
    mutationFn: (params: { clienteId: string; creditoId: string; mensaje: string }) =>
      registrarAlertaCobro(params.clienteId, params.creditoId, params.mensaje),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartera-morosa"] });
      toast.success("Seguimiento registrado exitosamente");
    },
    onError: (error: any) => {
      toast.error(`Error al registrar seguimiento: ${error.message}`);
    },
  });

  const { data: config } = useQuery({
    queryKey: ["configuracion-negocio"],
    queryFn: obtenerConfiguracion,
  });

  const penalidadMutation = useMutation({
    mutationFn: (params: { cliente: ClienteMoroso, porcentaje: number }) =>
      aplicarPenalidadIndividual(params.cliente, params.porcentaje),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartera-morosa"] });
      toast.success("Recargo aplicado exitosamente");
    },
    onError: (error: any) => {
      toast.error(`Error al aplicar recargos: ${error.message}`);
    },
  });

  const handleCobrarWhatsApp = (cliente: ClienteMoroso) => {
    // Generar mensaje
    const mensaje = `Hola *${cliente.nombreCliente}*, te escribimos de Mercacrédito. Tu cuota de *${formatearMoneda(cliente.saldoVencido)}* registra *${cliente.diasAtraso}* días de mora. Por favor contáctanos para regularizar tu estado.`;
    
    // Limpiar teléfono
    const telefonoLimpio = cliente.telefono.replace(/\D/g, "");
    
    // Enviar a la base de datos (tracking) en background
    alertaMutation.mutate({
      clienteId: cliente.clienteId,
      creditoId: cliente.creditoId,
      mensaje,
    });

    // Abrir WhatsApp
    const url = `https://wa.me/57${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  };

  const renderizarUltimoAviso = (fechaIso: string | null) => {
    if (!fechaIso) return <span className="text-muted-foreground text-xs italic">Sin avisos</span>;
    const fecha = new Date(fechaIso);
    if (isToday(fecha)) {
      return (
        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
          <CheckIcon className="w-3 h-3" /> Hoy
        </span>
      );
    }
    return <span className="text-foreground text-xs">{format(fecha, "dd MMM yyyy", { locale: es })}</span>;
  };

  const porcentajeMora = config?.porcentaje_mora_mes_3 ?? 3;

  return (
    <AppShell
      title="Gestión de Mora"
      subtitle="Panel de control para la cobranza asistida y seguimiento de cartera vencida"
    >
      <div className="space-y-6">
        {/* Estadísticas / Resumen */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/60 shadow-sm bg-rose-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                Mora Crítica (&gt; 30 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {morosos.filter((m) => m.diasAtraso > 30).length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                Mora Alerta (15-30 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {morosos.filter((m) => m.diasAtraso >= 15 && m.diasAtraso <= 30).length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-orange-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <CalendarIcon className="h-4 w-4" />
                Mora Preventiva (1-14 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                {morosos.filter((m) => m.diasAtraso >= 1 && m.diasAtraso < 15).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de Control */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Listado de Clientes en Mora</CardTitle>
              <CardDescription>
                Gestiona los avisos de cobro y realiza seguimiento. Los clientes con la fecha final del crédito vencida son elegibles para el recargo mensual.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ) : isError ? (
              <div className="text-center py-10 text-destructive font-semibold">
                Error al cargar la cartera morosa.
              </div>
            ) : morosos.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/10 mx-4 sm:mx-0 mb-4 sm:mb-0">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckIcon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-sm font-bold text-foreground">¡Excelente!</h3>
                <p className="text-xs text-muted-foreground mt-1">No hay clientes con atraso en este momento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Nivel de Mora</TableHead>
                      <TableHead className="text-right">Días Atraso</TableHead>
                      <TableHead className="text-right">Vencimiento Final</TableHead>
                      <TableHead className="text-right">Saldo Total</TableHead>
                      <TableHead className="text-center">Último Aviso</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {morosos.map((cliente) => {
                      const semaforo = determinarSemaforo(cliente.diasAtraso);
                      
                      // Validación para aplicar penalidad mensual
                      let penalidadDisponible = false;
                      let diasDesdeUltimaPenalidad = 999;
                      
                      if (cliente.diasDesdeVencimientoFinal > 0) {
                        if (cliente.ultimaPenalidadVencimiento) {
                          const fechaUltima = new Date(cliente.ultimaPenalidadVencimiento);
                          diasDesdeUltimaPenalidad = differenceInDays(new Date(), fechaUltima);
                          penalidadDisponible = diasDesdeUltimaPenalidad >= 30;
                        } else {
                          penalidadDisponible = true; // Nunca se ha cobrado
                        }
                      }
                      
                      const recargoEstimado = Math.round(cliente.saldoPendienteTotal * (porcentajeMora / 100));
                      
                      return (
                        <TableRow key={cliente.creditoId} className={`hover:bg-muted/5 ${penalidadDisponible ? "bg-rose-500/5" : ""}`}>
                          <TableCell>
                            <div className="font-semibold text-sm text-foreground">
                              {cliente.nombreCliente}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {cliente.telefono || "Sin teléfono"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={semaforo.color}>
                              {semaforo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">
                            {cliente.diasAtraso}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {cliente.fechaFinalEstimada ? (
                              <span className={cliente.diasDesdeVencimientoFinal > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                                {format(new Date(cliente.fechaFinalEstimada + "T12:00:00"), "dd MMM yyyy", { locale: es })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm text-primary">
                            {formatearMoneda(cliente.saldoPendienteTotal)}
                          </TableCell>
                          <TableCell className="text-center">
                            {renderizarUltimoAviso(cliente.ultimoAviso)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {penalidadDisponible && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="font-bold rounded-xl h-8"
                                      disabled={penalidadMutation.isPending}
                                      title="Aplicar Recargo por Vencimiento"
                                    >
                                      <AlertTriangle className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cobrar Recargo por Mora</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        El crédito de <strong>{cliente.nombreCliente}</strong> superó la fecha final de pago.
                                        <br /><br />
                                        Se sumará un <strong>{porcentajeMora}%</strong> sobre el saldo total de {formatearMoneda(cliente.saldoPendienteTotal)}.
                                        <br /><br />
                                        Monto a recargar: <strong>{formatearMoneda(recargoEstimado)}</strong>.
                                        Este valor se distribuirá entre las cuotas que le faltan por pagar.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => penalidadMutation.mutate({ cliente, porcentaje: porcentajeMora })}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Aplicar Cargo
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              
                              <Button
                                size="sm"
                                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold rounded-xl h-8"
                                onClick={() => handleCobrarWhatsApp(cliente)}
                                disabled={!cliente.telefono || alertaMutation.isPending}
                              >
                                <MessageCircle className="w-4 h-4 sm:mr-1.5" />
                                <span className="hidden sm:inline">Cobrar</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

// Custom simple check icon because lucide Check might not be imported 
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
