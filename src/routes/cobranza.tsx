import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Phone,
  Camera,
  X,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Info,
  Calendar,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";

import {
  obtenerCreditosCobro,
  registrarRecaudo,
  type CreditoCobro,
} from "@/services/recaudoService";

// ─── Definición de Ruta ───────────────────────────────────────────────────────

export const Route = createFileRoute("/cobranza")({
  head: () => ({
    meta: [
      { title: "Mi Ruta de Cobro — Mercacrédito" },
      {
        name: "description",
        content: "Gestión de cobranza móvil y recaudos diarios por cobrador.",
      },
    ],
  }),
  component: CobranzaPage,
});

// ─── Esquema de Validación Zod ──────────────────────────────────────────────

const recaudoSchema = z.object({
  valor_recibido: z.coerce
    .number({ invalid_type_error: "El valor recibido debe ser un número" })
    .min(1, "El valor recibido debe ser mayor a 0"),
  observaciones: z.string().optional(),
});

type RecaudoFormValues = z.infer<typeof recaudoSchema>;

// ─── Mapeos de Estado para UI ────────────────────────────────────────────────

const ESTADO_CONFIG = {
  "Al día": {
    badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  "Próximo a vencer": {
    badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  "En mora": {
    badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 dark:bg-rose-500/20",
    textClass: "text-rose-600 dark:text-rose-400",
  },
  // Fallbacks para otros posibles estados en BD
  "Atrasado": {
    badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 dark:bg-rose-500/20",
    textClass: "text-rose-600 dark:text-rose-400",
  },
  "Cancelado": {
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-muted-foreground",
  },
  "Finalizado": {
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-muted-foreground",
  },
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

const formatearMoneda = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor);
};

// ─── Componente Principal ────────────────────────────────────────────────────

function CobranzaPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [creditoSeleccionado, setCreditoSeleccionado] = useState<CreditoCobro | null>(null);

  // Estados del archivo de foto
  const [fotoSoporte, setFotoSoporte] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // 1. Cargar datos con React Query
  const {
    data: creditos = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["creditos", "cobro"],
    queryFn: obtenerCreditosCobro,
  });

  // 2. React Hook Form para validación
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RecaudoFormValues>({
    resolver: zodResolver(recaudoSchema),
    defaultValues: {
      valor_recibido: undefined,
      observaciones: "",
    },
  });

  // 3. Mutación para registrar el pago
  const mutation = useMutation({
    mutationFn: (values: {
      creditoId: string;
      valorRecibido: number;
      fotoDinero?: File | null;
      observaciones?: string;
    }) => registrarRecaudo(values),
    onSuccess: () => {
      toast.success("Pago registrado, pendiente de aprobación");
      queryClient.invalidateQueries({ queryKey: ["creditos", "cobro"] });
      cerrarDrawer();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar el pago");
    },
  });

  // 4. Filtrar clientes localmente por nombre, cédula o barrio
  const creditosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return creditos;
    return creditos.filter(
      (item) =>
        item.cliente.nombres.toLowerCase().includes(q) ||
        item.cliente.apellidos.toLowerCase().includes(q) ||
        item.cliente.cedula.includes(q) ||
        item.cliente.barrio.toLowerCase().includes(q)
    );
  }, [creditos, busqueda]);

  // 5. Manejo del input de archivo / foto
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor selecciona un archivo de imagen");
        return;
      }
      setFotoSoporte(file);
      const url = URL.createObjectURL(file);
      setFotoPreview(url);
    }
  };

  const removerFoto = () => {
    setFotoSoporte(null);
    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
    }
  };

  // 6. Abrir y cerrar panel
  const abrirDrawer = (credito: CreditoCobro) => {
    setCreditoSeleccionado(credito);
    // Inicializar el valor recibido con la totalidad del saldo pendiente como sugerencia
    reset({
      valor_recibido: undefined,
      observaciones: "",
    });
    removerFoto();
  };

  const cerrarDrawer = () => {
    setCreditoSeleccionado(null);
    reset();
    removerFoto();
  };

  const onSubmit = (values: RecaudoFormValues) => {
    if (!creditoSeleccionado) return;

    mutation.mutate({
      creditoId: creditoSeleccionado.id,
      valorRecibido: values.valor_recibido,
      fotoDinero: fotoSoporte,
      observaciones: values.observaciones,
    });
  };

  return (
    <AppShell title="Mi Ruta de Cobro" subtitle="Ruta diaria de recaudos para cobrador">
      <div className="mx-auto max-w-md space-y-4">
        {/* Barra de Búsqueda Superior */}
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nombre, cédula o barrio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-12 pl-10 pr-10 text-base rounded-xl shadow-xs"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Resumen de ruta */}
        {!isLoading && !isError && (
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              Clientes en ruta: <strong>{creditosFiltrados.length}</strong>
            </span>
            <span>
              Saldo total pendiente:{" "}
              <strong>
                {formatearMoneda(
                  creditosFiltrados.reduce((sum, item) => sum + item.saldo_pendiente, 0)
                )}
              </strong>
            </span>
          </div>
        )}

        {/* Estado de error */}
        {isError && (
          <Card className="border-destructive/30 bg-destructive/5 text-center p-6">
            <CardContent className="space-y-3 pt-6">
              <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                No se pudo cargar la ruta de cobro.
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loader de carga */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="animate-pulse">
                <CardContent className="h-32 p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded-sm w-3/4" />
                    <div className="h-3 bg-muted rounded-sm w-1/2" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-muted rounded-sm w-1/4" />
                    <div className="h-6 bg-muted rounded-md w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Lista vacía */}
        {!isLoading && !isError && creditosFiltrados.length === 0 && (
          <Card className="p-8 text-center border-dashed">
            <CardContent className="space-y-2 pt-6">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No se encontraron créditos activos
              </p>
              <p className="text-xs text-muted-foreground">
                {busqueda
                  ? "Intenta buscar con otros términos de búsqueda."
                  : "No hay clientes asignados a tu ruta de cobranza en este momento."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tarjetas de Clientes (Cards apiladas verticalmente) */}
        {!isLoading && !isError && creditosFiltrados.length > 0 && (
          <div className="space-y-3">
            {creditosFiltrados.map((item) => {
              const config = ESTADO_CONFIG[item.estado] || ESTADO_CONFIG["Al día"];
              return (
                <Card
                  key={item.id}
                  onClick={() => abrirDrawer(item)}
                  className="overflow-hidden border border-border/60 shadow-xs hover:border-primary/40 active:scale-[0.99] transition-all duration-100 cursor-pointer"
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Fila superior: Nombre y Estado */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight text-foreground truncate">
                          {item.cliente.nombres} {item.cliente.apellidos}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          CC {item.cliente.cedula} | {item.numero_factura}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-2xs px-2 py-0.5 shrink-0 ${config.badgeClass}`}
                      >
                        {item.estado}
                      </Badge>
                    </div>

                    {/* Fila central: Barrio y Botón de llamada */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="h-4 w-4 text-muted-foreground/75 shrink-0" />
                        <span className="truncate">{item.cliente.barrio}</span>
                      </div>

                      <a
                        href={`tel:${item.cliente.telefono_principal}`}
                        onClick={(e) => e.stopPropagation()} // Evita abrir el modal
                        className="flex items-center justify-center h-8 px-3 rounded-lg border border-border bg-card text-primary active:bg-muted transition-colors gap-1.5"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Llamar</span>
                      </a>
                    </div>

                    <div className="h-px bg-border/60" />

                    {/* Fila inferior: Saldo pendiente destacado */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        Saldo Pendiente:
                      </span>
                      <span className="text-lg font-bold tracking-tight text-foreground">
                        {formatearMoneda(item.saldo_pendiente)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Drawer de Registro de Pago (Vaul) */}
        <Drawer open={creditoSeleccionado !== null} onOpenChange={(open) => !open && cerrarDrawer()}>
          <DrawerContent className="max-w-md mx-auto">
            {creditoSeleccionado && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle className="text-lg font-bold">Registrar Recaudo</DrawerTitle>
                  <DrawerDescription className="text-xs text-muted-foreground">
                    Registrar abono de cuota o cancelación para{" "}
                    <strong>
                      {creditoSeleccionado.cliente.nombres}{" "}
                      {creditoSeleccionado.cliente.apellidos}
                    </strong>
                    .
                  </DrawerDescription>
                </DrawerHeader>

                <div className="px-4 space-y-4">
                  {/* Resumen del Saldo Actual */}
                  <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/15 p-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                        Saldo Pendiente Actual
                      </span>
                      <p className="text-xl font-black text-primary">
                        {formatearMoneda(creditoSeleccionado.saldo_pendiente)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setValue("valor_recibido", creditoSeleccionado.saldo_pendiente)
                      }
                      className="text-xs font-semibold h-8 border-primary/20 hover:bg-primary/10 hover:text-primary"
                    >
                      Pagar Total
                    </Button>
                  </div>

                  {/* Input Valor Recibido */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="valor_recibido"
                      className="text-xs font-bold text-foreground block"
                    >
                      Valor Recibido <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="valor_recibido"
                        type="number"
                        inputMode="numeric"
                        placeholder="0"
                        {...register("valor_recibido")}
                        className="h-11 pl-9 text-base rounded-lg shadow-2xs"
                      />
                    </div>
                    {errors.valor_recibido && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {errors.valor_recibido.message}
                      </p>
                    )}
                  </div>

                  {/* Input Foto Soporte */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Foto del Dinero / Soporte (Opcional)
                    </label>

                    {!fotoPreview ? (
                      <div className="relative border border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFotoChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                            <Camera className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-primary block">
                              Tomar Foto / Subir Imagen
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Formato JPG, PNG. Máx. 10MB
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative border rounded-xl overflow-hidden bg-muted/20">
                        <img
                          src={fotoPreview}
                          alt="Previsualización soporte"
                          className="w-full h-32 object-contain bg-black/5 dark:bg-black/20"
                        />
                        <button
                          type="button"
                          onClick={removerFoto}
                          className="absolute top-2 right-2 h-7 w-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Observaciones */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="observaciones"
                      className="text-xs font-bold text-foreground block"
                    >
                      Observaciones (Opcional)
                    </label>
                    <Textarea
                      id="observaciones"
                      placeholder="Comentarios o notas sobre el recaudo..."
                      {...register("observaciones")}
                      className="min-h-[70px] resize-none text-sm rounded-lg"
                    />
                  </div>
                </div>

                <DrawerFooter className="pt-2 gap-2">
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    className="h-11 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Registrando Pago...
                      </>
                    ) : (
                      <>Registrar Pago</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cerrarDrawer}
                    disabled={mutation.isPending}
                    className="h-10 text-xs rounded-xl"
                  >
                    Cancelar
                  </Button>
                </DrawerFooter>
              </form>
            )}
          </DrawerContent>
        </Drawer>
      </div>
    </AppShell>
  );
}
