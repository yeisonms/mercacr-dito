import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Sliders,
  Percent,
  CalendarDays,
  Save,
  Loader2,
  HelpCircle,
  MessageSquare,
  AlertTriangle,
  Info,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  obtenerConfiguracion,
  guardarConfiguracion,
  type ConfiguracionNegocio,
} from "@/services/configuracionService";

// ─── Definición de Ruta ───────────────────────────────────────────────────────

export const Route = createFileRoute("/configuracion_/mora")({
  head: () => ({
    meta: [
      { title: "Configuración de Mora — Mercacrédito" },
      {
        name: "description",
        content: "Parámetros globales de mora, recargos y plantillas de cobro.",
      },
    ],
  }),
  component: ConfiguracionMoraPage,
});

// ─── Esquema de Validación Zod ──────────────────────────────────────────────

const configuracionSchema = z.object({
  dias_gracia_mora: z.coerce
    .number({ invalid_type_error: "Debe ser un número válido" })
    .int("Debe ser un número entero")
    .min(0, "Los días de gracia no pueden ser negativos"),
  porcentaje_mora_mes_3: z.coerce
    .number({ invalid_type_error: "Debe ser un número válido" })
    .min(0, "El porcentaje no puede ser negativo")
    .max(100, "El porcentaje no puede ser superior al 100%"),
  plantilla_recordatorio_antici: z
    .string()
    .min(1, "La plantilla de recordatorio es obligatoria")
    .max(1000, "La plantilla no debe superar los 1000 caracteres"),
  plantilla_mora_critica: z
    .string()
    .min(1, "La plantilla de mora crítica es obligatoria")
    .max(1000, "La plantilla no debe superar los 1000 caracteres"),
});

type ConfiguracionFormValues = z.infer<typeof configuracionSchema>;

// ─── Componente Principal ────────────────────────────────────────────────────

function ConfiguracionMoraPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);

  // Inicializar React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ConfiguracionFormValues>({
    resolver: zodResolver(configuracionSchema),
    defaultValues: {
      dias_gracia_mora: 2,
      porcentaje_mora_mes_3: 5.0,
      plantilla_recordatorio_antici: "",
      plantilla_mora_critica: "",
    },
  });

  // 1. Cargar la configuración desde Supabase al iniciar
  useEffect(() => {
    async function cargarDatos() {
      try {
        setIsLoading(true);
        const config = await obtenerConfiguracion();
        reset({
          dias_gracia_mora: config.dias_gracia_mora,
          porcentaje_mora_mes_3: config.porcentaje_mora_mes_3,
          plantilla_recordatorio_antici: config.plantilla_recordatorio_antici,
          plantilla_mora_critica: config.plantilla_mora_critica,
        });
        if (config.ultima_actualizacion) {
          setUltimaActualizacion(config.ultima_actualizacion);
        }
      } catch (error: any) {
        toast.error(error.message || "Error al cargar la configuración");
      } finally {
        setIsLoading(false);
      }
    }

    cargarDatos();
  }, [reset]);

  // 2. Guardar la configuración
  const onSubmit = async (values: ConfiguracionFormValues) => {
    try {
      setIsSaving(true);
      const configActualizada = await guardarConfiguracion(values);
      toast.success("Configuración de mora y recargos actualizada con éxito");
      
      // Actualizar estado del formulario
      reset({
        dias_gracia_mora: configActualizada.dias_gracia_mora,
        porcentaje_mora_mes_3: configActualizada.porcentaje_mora_mes_3,
        plantilla_recordatorio_antici: configActualizada.plantilla_recordatorio_antici,
        plantilla_mora_critica: configActualizada.plantilla_mora_critica,
      });

      if (configActualizada.ultima_actualizacion) {
        setUltimaActualizacion(configActualizada.ultima_actualizacion);
      }
    } catch (error: any) {
      toast.error(error.message || "Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const formatearFecha = (fechaStr: string) => {
    try {
      return new Date(fechaStr).toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return fechaStr;
    }
  };

  return (
    <AppShell
      title="Configuración de Mora"
      subtitle="Definición de penalidades de crédito y plantillas para cobranza automática"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Banner Informativo */}
        <Card className="border-amber-200/50 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-950/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Parámetros Financieros Críticos
              </h4>
              <p className="text-xs text-amber-700/90 dark:text-amber-400/80 leading-relaxed">
                Estos valores regulan los recargos aplicados automáticamente a los saldos atrasados
                y las plantillas enviadas por mensajería. Cualquier cambio impactará las
                notificaciones enviadas a partir de este momento.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Formulario / Skeletons */}
        {isLoading ? (
          <Card className="border-border/60 shadow-xs">
            <CardHeader>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-28 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-28 w-full" />
              </div>
              <div className="flex justify-end pt-4">
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card className="border-border/60 shadow-xs">
              <CardHeader className="border-b border-border/40 pb-4 bg-muted/10">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">Parámetros del Negocio</CardTitle>
                    <CardDescription>
                      Edita las reglas de recargos mensuales y las notificaciones automáticas.
                    </CardDescription>
                  </div>
                  {ultimaActualizacion && (
                    <div className="text-[10px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border self-start md:self-center font-mono">
                      Última actualización: {formatearFecha(ultimaActualizacion)}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Inputs de Configuración de Mora */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Días de Gracia */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="dias_gracia_mora"
                      className="text-xs font-bold text-foreground flex items-center gap-1.5"
                    >
                      Días de gracia antes de mora
                      <span title="Días de prórroga permitidos al cliente después de la fecha de vencimiento sin aplicar penalizaciones.">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/80 cursor-help" />
                      </span>
                    </Label>
                    <div className="relative">
                      <CalendarDays className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="dias_gracia_mora"
                        type="number"
                        placeholder="Ej. 2"
                        {...register("dias_gracia_mora")}
                        className="h-11 pl-9 rounded-lg"
                      />
                    </div>
                    {errors.dias_gracia_mora && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {errors.dias_gracia_mora.message}
                      </p>
                    )}
                  </div>

                  {/* Porcentaje de Mora */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="porcentaje_mora_mes_3"
                      className="text-xs font-bold text-foreground flex items-center gap-1.5"
                    >
                      Porcentaje de recargo (después del mes 3)
                      <span title="Porcentaje mensual adicional de recargo que se le sumará al saldo pendiente del cliente si el crédito supera los 3 meses en mora.">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/80 cursor-help" />
                      </span>
                    </Label>
                    <div className="relative">
                      <Percent className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="porcentaje_mora_mes_3"
                        type="number"
                        step="0.01"
                        placeholder="Ej. 5.00"
                        {...register("porcentaje_mora_mes_3")}
                        className="h-11 pr-9 rounded-lg"
                      />
                    </div>
                    {errors.porcentaje_mora_mes_3 && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {errors.porcentaje_mora_mes_3.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Sección de Plantillas */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      Mensajería de Cobranza (WhatsApp)
                    </h3>
                  </div>

                  {/* Plantilla Recordatorio */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="plantilla_recordatorio_antici"
                      className="text-xs font-bold text-foreground"
                    >
                      Plantilla WhatsApp - Recordatorio de Pre-vencimiento
                    </Label>
                    <Textarea
                      id="plantilla_recordatorio_antici"
                      rows={4}
                      placeholder="Mensaje de recordatorio amable..."
                      {...register("plantilla_recordatorio_antici")}
                      className="resize-none rounded-lg text-sm"
                    />
                    {errors.plantilla_recordatorio_antici && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {errors.plantilla_recordatorio_antici.message}
                      </p>
                    )}
                  </div>

                  {/* Plantilla Mora Crítica */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="plantilla_mora_critica"
                      className="text-xs font-bold text-foreground"
                    >
                      Plantilla WhatsApp - Cobranza en Mora Crítica (Aviso Fuerte)
                    </Label>
                    <Textarea
                      id="plantilla_mora_critica"
                      rows={4}
                      placeholder="Mensaje de cobro formal/fuerte..."
                      {...register("plantilla_mora_critica")}
                      className="resize-none rounded-lg text-sm"
                    />
                    {errors.plantilla_mora_critica && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {errors.plantilla_mora_critica.message}
                      </p>
                    )}
                  </div>

                  {/* Variables dinámicas soportadas */}
                  <div className="rounded-lg bg-muted/40 p-4 border text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <Sliders className="h-3.5 w-3.5 text-primary" />
                      Variables dinámicas de reemplazo recomendadas:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[10px]">
                      <div className="bg-background p-1.5 rounded border border-border/80">
                        {`{cliente}`}
                      </div>
                      <div className="bg-background p-1.5 rounded border border-border/80">
                        {`{cuota}`}
                      </div>
                      <div className="bg-background p-1.5 rounded border border-border/80">
                        {`{fecha}`}
                      </div>
                      <div className="bg-background p-1.5 rounded border border-border/80">
                        {`{saldo}`}
                      </div>
                    </div>
                    <p className="text-[10px] leading-relaxed italic">
                      Nota: Al enviar mensajes, estas etiquetas serán reemplazadas por la información
                      real del cliente y del crédito correspondiente.
                    </p>
                  </div>
                </div>
              </CardContent>

              {/* Botón de Guardado */}
              <div className="border-t border-border/40 p-4 bg-muted/5 flex justify-end gap-3 rounded-b-xl">
                <Button
                  type="submit"
                  disabled={isSaving || !isDirty}
                  className="h-11 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-2 font-semibold shadow-xs transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </form>
        )}
      </div>
    </AppShell>
  );
}
