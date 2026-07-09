import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, AlertTriangle, Clock, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { obtenerCarteraMorosa, registrarAlertaCobro, ClienteMoroso } from "@/services/moraService";
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Listado de Clientes en Mora</CardTitle>
            <CardDescription>
              Gestiona los avisos de cobro y realiza el seguimiento mediante WhatsApp.
            </CardDescription>
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
                      <TableHead className="text-right">Saldo Vencido</TableHead>
                      <TableHead className="text-center">Último Aviso</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {morosos.map((cliente) => {
                      const semaforo = determinarSemaforo(cliente.diasAtraso);
                      
                      return (
                        <TableRow key={cliente.creditoId} className="hover:bg-muted/5">
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
                          <TableCell className="text-right font-bold text-sm text-primary">
                            {formatearMoneda(cliente.saldoVencido)}
                          </TableCell>
                          <TableCell className="text-center">
                            {renderizarUltimoAviso(cliente.ultimoAviso)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold rounded-xl h-8"
                              onClick={() => handleCobrarWhatsApp(cliente)}
                              disabled={!cliente.telefono || alertaMutation.isPending}
                            >
                              <MessageCircle className="w-4 h-4 mr-1.5" />
                              Cobrar
                            </Button>
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
