import { useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit3,
  FileImage,
  Loader2,
  MapPin,
  Phone,
  Save,
  User,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  obtenerCliente,
  actualizarCliente,
  listarRutas,
  type EstadoCliente,
  type ActualizarClienteInput,
} from "@/services/cliente.service";

// ─── Ruta dinámica ────────────────────────────────────────────────────────────

export const Route = createFileRoute("/clientes/$clienteId")({
  head: () => ({
    meta: [{ title: "Perfil de cliente — Mercacrédito" }],
  }),
  component: ClientePerfilPage,
});

// ─── Schema de edición ────────────────────────────────────────────────────────

const soloDigitos = (msg: string) =>
  z.string().trim().min(1, { message: msg }).regex(/^\d+$/, {
    message: "Solo se permiten números",
  });

const editSchema = z.object({
  nombres: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  apellidos: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  telefono_principal: soloDigitos("El teléfono es requerido").max(20),
  telefono_alterno: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d*$/, "Solo números")
    .optional()
    .or(z.literal("")),
  direccion: z.string().trim().min(3, "La dirección es requerida").max(150),
  barrio: z.string().trim().min(2, "El barrio es requerido").max(100),
  ciudad: z.string().trim().min(2, "La ciudad es requerida").max(100),
  lugar_trabajo: z.string().trim().max(150).optional().or(z.literal("")),
  telefono_trabajo: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d*$/, "Solo números")
    .optional()
    .or(z.literal("")),
  ruta_id: z.string().min(1, "Selecciona una ruta"),
  estado: z.enum(["Activo", "Inactivo", "Moroso", "Judicial", "Finalizado"]),
});

type EditValues = z.infer<typeof editSchema>;

// ─── Colores de estado ────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<EstadoCliente, string> = {
  Activo:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  Moroso: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
  Judicial:
    "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  Inactivo: "bg-muted text-muted-foreground border-border",
  Finalizado: "bg-muted text-muted-foreground border-border",
};

// ─── Componente principal ─────────────────────────────────────────────────────

function ClientePerfilPage() {
  const { clienteId } = useParams({ from: "/clientes/$clienteId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modoEdicion, setModoEdicion] = useState(false);

  // ── Fetch del cliente ──────────────────────────────────────────────────────
  const {
    data: cliente,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["clientes", clienteId],
    queryFn: () => obtenerCliente(clienteId),
    enabled: !!clienteId,
  });

  // ── Fetch de rutas para el select ─────────────────────────────────────────
  const { data: rutas = [] } = useQuery({
    queryKey: ["rutas"],
    queryFn: listarRutas,
    staleTime: 5 * 60_000,
  });

  // ── Formulario ─────────────────────────────────────────────────────────────
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: cliente
      ? {
          nombres: cliente.nombres,
          apellidos: cliente.apellidos,
          telefono_principal: cliente.telefono_principal,
          telefono_alterno: cliente.telefono_alterno ?? "",
          direccion: cliente.direccion,
          barrio: cliente.barrio,
          ciudad: cliente.ciudad,
          lugar_trabajo: cliente.lugar_trabajo ?? "",
          telefono_trabajo: cliente.telefono_trabajo ?? "",
          ruta_id: cliente.ruta_id,
          estado: cliente.estado,
        }
      : undefined,
  });

  // ── Mutación de actualización ──────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (input: ActualizarClienteInput) =>
      actualizarCliente(clienteId, input),
    onSuccess: () => {
      toast.success("Cliente actualizado correctamente");
      // Invalida ambas queries para refrescar lista y perfil
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setModoEdicion(false);
    },
    onError: (error) => {
      const msg =
        error instanceof Error ? error.message : "Error al actualizar";
      toast.error("No se pudo actualizar el cliente", { description: msg });
    },
  });

  const onSubmit = (values: EditValues) => {
    mutation.mutate({
      ...values,
      telefono_alterno: values.telefono_alterno || null,
      lugar_trabajo: values.lugar_trabajo || null,
      telefono_trabajo: values.telefono_trabajo || null,
    });
  };

  const cancelarEdicion = () => {
    form.reset();
    setModoEdicion(false);
  };

  // ── Acciones del header ────────────────────────────────────────────────────
  const headerActions = (
    <div className="flex items-center gap-2">
      {!modoEdicion ? (
        <Button
          size="sm"
          onClick={() => setModoEdicion(true)}
          disabled={isLoading || isError}
        >
          <Edit3 className="mr-2 h-4 w-4" />
          Editar
        </Button>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelarEdicion}
            disabled={mutation.isPending}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={form.handleSubmit(onSubmit)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar cambios
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );

  // ── Estado de carga ────────────────────────────────────────────────────────
  if (isLoading) return <PerfilSkeleton />;

  // ── Estado de error ────────────────────────────────────────────────────────
  if (isError || !cliente) {
    return (
      <AppShell title="Perfil de cliente">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-sm text-destructive font-medium">
            No se pudo cargar el perfil del cliente.
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/clientes" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la lista
          </Button>
        </div>
      </AppShell>
    );
  }

  // ── Render principal ───────────────────────────────────────────────────────
  const initiales =
    cliente.nombres.charAt(0).toUpperCase() +
    cliente.apellidos.charAt(0).toUpperCase();

  const fechaFormateada = new Date(cliente.fecha_creacion).toLocaleDateString(
    "es-CO",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <AppShell
      title={modoEdicion ? "Editar cliente" : "Perfil del cliente"}
      subtitle={`${cliente.codigo_consecutivo} · ${cliente.nombres} ${cliente.apellidos}`}
      actions={headerActions}
    >
      {/* Breadcrumb */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/clientes">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Volver a Clientes
          </Link>
        </Button>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mx-auto max-w-4xl space-y-6"
        >
          {/* ── Header del perfil ── */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                {/* Avatar grande */}
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                  {initiales}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold truncate">
                      {cliente.nombres} {cliente.apellidos}
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${ESTADO_COLORS[cliente.estado]}`}
                    >
                      {cliente.estado}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground font-mono">
                    {cliente.codigo_consecutivo}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Registrado el {fechaFormateada}
                    </span>
                    {cliente.ruta?.nombre_ruta && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Ruta: {cliente.ruta.nombre_ruta}
                      </span>
                    )}
                  </div>
                </div>

                {/* Datos inmutables */}
                <div className="flex flex-col items-end gap-1 text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Cédula</p>
                  <p className="font-mono font-semibold">{cliente.cedula}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Secuencia de visita
                  </p>
                  <p className="font-semibold"># {cliente.secuencia_visita}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Datos personales ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Datos personales</CardTitle>
                  <CardDescription>
                    La cédula no puede modificarse
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="nombres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombres *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apellidos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellidos *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Cédula — solo lectura siempre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Cédula (inmutable)
                </label>
                <Input value={cliente.cedula} disabled className="bg-muted/40 font-mono" />
              </div>
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!modoEdicion || mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className={!modoEdicion ? "bg-muted/40" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          ["Activo", "Inactivo", "Moroso", "Judicial", "Finalizado"] as EstadoCliente[]
                        ).map((e) => (
                          <SelectItem key={e} value={e}>
                            {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefono_principal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono principal *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="tel"
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefono_alterno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono alterno</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="tel"
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                        placeholder="Opcional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Ubicación y trabajo ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Ubicación y trabajo</CardTitle>
                  <CardDescription>Residencia y datos laborales</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Dirección *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barrio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barrio *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lugar_trabajo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lugar de trabajo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                        placeholder="Opcional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefono_trabajo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono del trabajo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="tel"
                        disabled={!modoEdicion || mutation.isPending}
                        className={!modoEdicion ? "bg-muted/40" : ""}
                        placeholder="Opcional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ruta_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ruta asignada *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!modoEdicion || mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className={!modoEdicion ? "bg-muted/40" : ""}>
                          <SelectValue placeholder="Selecciona una ruta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rutas.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Documentación fotográfica ── */}
          {(cliente.foto_cliente_url ||
            cliente.foto_cedula_frente_url ||
            cliente.foto_cedula_respaldo_url) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <FileImage className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">
                      Documentación fotográfica
                    </CardTitle>
                    <CardDescription>
                      Imágenes almacenadas en el servidor
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Foto del cliente", url: cliente.foto_cliente_url },
                  { label: "Cédula (frente)", url: cliente.foto_cedula_frente_url },
                  { label: "Cédula (respaldo)", url: cliente.foto_cedula_respaldo_url },
                ]
                  .filter((d) => d.url)
                  .map((doc) => (
                    <div key={doc.label} className="flex flex-col gap-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {doc.label}
                      </p>
                      <img
                        src={doc.url!}
                        alt={doc.label}
                        className="h-32 w-full rounded-lg object-cover border"
                      />
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* ── Teléfonos rápidos (solo vista) ── */}
          {!modoEdicion && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">Contacto rápido</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${cliente.telefono_principal}`}>
                    <Phone className="mr-2 h-3.5 w-3.5" />
                    {cliente.telefono_principal}
                  </a>
                </Button>
                {cliente.telefono_alterno && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${cliente.telefono_alterno}`}>
                      <Phone className="mr-2 h-3.5 w-3.5" />
                      {cliente.telefono_alterno}
                    </a>
                  </Button>
                )}
                {cliente.telefono_trabajo && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${cliente.telefono_trabajo}`}>
                      <Building2 className="mr-2 h-3.5 w-3.5" />
                      {cliente.telefono_trabajo}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </AppShell>
  );
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function PerfilSkeleton() {
  return (
    <AppShell title="Perfil del cliente">
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-9 w-32" />
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6">
              <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
