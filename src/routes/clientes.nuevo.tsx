import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, User, MapPin, FileImage } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearCliente,
  listarRutas,
  type Ruta,
} from "@/services/cliente.service";

export const Route = createFileRoute("/clientes/nuevo")({
  head: () => ({
    meta: [
      { title: "Nuevo Cliente — Mercacrédito" },
      {
        name: "description",
        content:
          "Formulario de registro de nuevos clientes en el ERP Mercacrédito.",
      },
    ],
  }),
  component: NuevoClientePage,
});

const soloDigitos = (msg: string) =>
  z
    .string()
    .trim()
    .min(1, { message: msg })
    .regex(/^\d+$/, { message: "Solo se permiten números" });

const formSchema = z.object({
  // Datos personales
  nombres: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  apellidos: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  cedula: soloDigitos("La cédula es requerida").max(15, {
    message: "Máximo 15 dígitos",
  }),
  telefono_principal: soloDigitos("El teléfono principal es requerido").max(15, {
    message: "Máximo 15 dígitos",
  }),
  telefono_alterno: z
    .string()
    .trim()
    .max(15, { message: "Máximo 15 dígitos" })
    .regex(/^\d*$/, { message: "Solo se permiten números" })
    .optional()
    .or(z.literal("")),

  // Ubicación y trabajo
  direccion: z
    .string()
    .trim()
    .min(3, { message: "La dirección es requerida" })
    .max(150),
  barrio: z.string().trim().min(2, { message: "El barrio es requerido" }).max(80),
  ciudad: z.string().trim().min(2, { message: "La ciudad es requerida" }).max(80),
  lugar_trabajo: z.string().trim().max(120).optional().or(z.literal("")),
  telefono_trabajo: z
    .string()
    .trim()
    .max(15, { message: "Máximo 15 dígitos" })
    .regex(/^\d*$/, { message: "Solo se permiten números" })
    .optional()
    .or(z.literal("")),
  ruta_id: z.string().min(1, { message: "Selecciona una ruta" }),
});

type FormValues = z.infer<typeof formSchema>;

const valoresIniciales: FormValues = {
  nombres: "",
  apellidos: "",
  cedula: "",
  telefono_principal: "",
  telefono_alterno: "",
  direccion: "",
  barrio: "",
  ciudad: "Muzo",
  lugar_trabajo: "",
  telefono_trabajo: "",
  ruta_id: "",
};

function NuevoClientePage() {
  const navigate = useNavigate();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [archivos, setArchivos] = useState<{
    foto: File | null;
    cedulaFrente: File | null;
    cedulaRespaldo: File | null;
  }>({ foto: null, cedulaFrente: null, cedulaRespaldo: null });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: valoresIniciales,
  });

  useEffect(() => {
    listarRutas().then(setRutas).catch(() => setRutas([]));
  }, []);

  const onSubmit = async (values: FormValues) => {
    setEnviando(true);
    try {
      await crearCliente({
        ...values,
        telefono_alterno: values.telefono_alterno || null,
        lugar_trabajo: values.lugar_trabajo || null,
        telefono_trabajo: values.telefono_trabajo || null,
      });
      toast.success("Cliente registrado correctamente");
      form.reset(valoresIniciales);
      setArchivos({ foto: null, cedulaFrente: null, cedulaRespaldo: null });
      navigate({ to: "/clientes" });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Error al guardar el cliente";
      toast.error("No se pudo registrar el cliente", { description: msg });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppShell
      title="Nuevo Cliente"
      subtitle="Registra un cliente y asígnalo a una ruta de cobranza"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mx-auto max-w-4xl space-y-6"
        >
          {/* ============== 1. DATOS PERSONALES ============== */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle>Datos personales</CardTitle>
                  <CardDescription>
                    Información de identificación del cliente
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
                      <Input placeholder="Juan Carlos" {...field} />
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
                      <Input placeholder="Pérez Gómez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cedula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cédula *</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="1023456789"
                        {...field}
                      />
                    </FormControl>
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
                        inputMode="tel"
                        placeholder="3001234567"
                        {...field}
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
                  <FormItem className="md:col-span-2">
                    <FormLabel>Teléfono alterno</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="tel"
                        placeholder="Opcional"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ============== 2. UBICACIÓN Y TRABAJO ============== */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle>Ubicación y trabajo</CardTitle>
                  <CardDescription>
                    Dirección de residencia y datos laborales
                  </CardDescription>
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
                      <Input placeholder="Calle 5 # 4-23" {...field} />
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
                      <Input placeholder="Centro" {...field} />
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
                      <Input placeholder="Muzo" {...field} />
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
                      <Input placeholder="Opcional" {...field} />
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
                        inputMode="tel"
                        placeholder="Opcional"
                        {...field}
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
                  <FormItem className="md:col-span-2">
                    <FormLabel>Ruta asignada *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
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

          {/* ============== 3. DOCUMENTACIÓN ============== */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle>Documentación</CardTitle>
                  <CardDescription>
                    Fotos del cliente y de su cédula (la subida al Storage se
                    implementará luego)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FileFieldUI
                label="Foto del cliente"
                file={archivos.foto}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, foto: file }))
                }
              />
              <FileFieldUI
                label="Cédula (frente)"
                file={archivos.cedulaFrente}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, cedulaFrente: file }))
                }
              />
              <FileFieldUI
                label="Cédula (respaldo)"
                file={archivos.cedulaRespaldo}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, cedulaRespaldo: file }))
                }
              />
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={enviando}
              onClick={() => {
                form.reset(valoresIniciales);
                setArchivos({
                  foto: null,
                  cedulaFrente: null,
                  cedulaRespaldo: null,
                });
              }}
            >
              Limpiar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar cliente
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </AppShell>
  );
}

interface FileFieldUIProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function FileFieldUI({ label, file, onChange }: FileFieldUIProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
        />
      </FormControl>
      <FormDescription className="truncate">
        {file ? file.name : "Sin archivo seleccionado"}
      </FormDescription>
    </FormItem>
  );
}
