import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileImage,
  Loader2,
  MapPin,
  Save,
  Upload,
  User,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { Badge } from "@/components/ui/badge";

import { crearCliente, listarRutas, type Ruta } from "@/services/cliente.service";
import { subirDocumentosCliente, type TipoDocumento } from "@/services/storage.service";

// ─── Constantes ──────────────────────────────────────────────────────────────

const ARCHIVOS_MAX_MB = 5;
const ARCHIVOS_MAX_BYTES = ARCHIVOS_MAX_MB * 1024 * 1024;

// ─── Schema Zod ──────────────────────────────────────────────────────────────

const soloDigitos = (msg: string) =>
  z.string().trim().min(1, { message: msg }).regex(/^\d+$/, {
    message: "Solo se permiten números",
  });

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
  telefono_principal: soloDigitos("El teléfono principal es requerido").max(
    15,
    { message: "Máximo 15 dígitos" },
  ),
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
  barrio: z
    .string()
    .trim()
    .min(2, { message: "El barrio es requerido" })
    .max(80),
  ciudad: z
    .string()
    .trim()
    .min(2, { message: "La ciudad es requerida" })
    .max(80),
  lugar_trabajo: z.string().trim().max(120).optional().or(z.literal("")),
  telefono_trabajo: z
    .string()
    .trim()
    .max(15, { message: "Máximo 15 dígitos" })
    .regex(/^\d*$/, { message: "Solo se permiten números" })
    .optional()
    .or(z.literal("")),
  ruta_id: z.string().min(1, { message: "Selecciona una ruta" }),
  latitud: z.coerce.number().optional().nullable(),
  longitud: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const VALORES_INICIALES: FormValues = {
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
  latitud: null,
  longitud: null,
};

// ─── Estado de subida ─────────────────────────────────────────────────────────

type FaseEnvio =
  | "idle"
  | "subiendo_documentos"
  | "guardando_cliente"
  | "completado";

const ETIQUETAS_FASE: Record<FaseEnvio, string> = {
  idle: "Guardar cliente",
  subiendo_documentos: "Subiendo documentos…",
  guardando_cliente: "Guardando cliente…",
  completado: "¡Guardado!",
};

// ─── Componente principal ─────────────────────────────────────────────────────

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

function NuevoClientePage() {
  const navigate = useNavigate();

  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargandoRutas, setCargandoRutas] = useState(true);
  const [fase, setFase] = useState<FaseEnvio>("idle");
  const [progresoSubida, setProgresoSubida] = useState(0); // 0-100

  // Leaflet Map states & refs
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  /** Archivos seleccionados por el usuario */
  const [archivos, setArchivos] = useState<
    Record<TipoDocumento, File | null>
  >({
    foto: null,
    cedula_frente: null,
    cedula_respaldo: null,
    foto_casa_1: null,
    foto_casa_2: null,
  });

  const enviando = fase !== "idle";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: VALORES_INICIALES,
  });

  const latitudValue = form.watch("latitud");
  const longitudValue = form.watch("longitud");

  // 1. Cargar scripts de Leaflet (solo cliente, SSR safe)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Agregar CSS de Leaflet si no existe
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const checkLReady = () => {
      if ((window as any).L) {
        setLeafletLoaded(true);
        return true;
      }
      return false;
    };

    let intervalId: any = null;

    // Agregar JS de Leaflet si no existe
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        intervalId = setInterval(() => {
          if (checkLReady()) {
            clearInterval(intervalId);
          }
        }, 50);
      };
      document.body.appendChild(script);
    } else {
      if (!checkLReady()) {
        intervalId = setInterval(() => {
          if (checkLReady()) {
            intervalId && clearInterval(intervalId);
          }
        }, 50);
      }
    }

    return () => {
      // Limpieza del mapa al desmontar
      if (intervalId) clearInterval(intervalId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Inicializar o actualizar el mapa
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Ubicación inicial por defecto: Muzo, Colombia
    const initialLat = latitudValue || 5.5310;
    const initialLng = longitudValue || -74.1080;

    if (!mapInstanceRef.current) {
      // Crear instancia de mapa
      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 14);
      
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Crear marcador arrastrable
      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

      // Capturar movimiento del marcador
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        form.setValue("latitud", Number(pos.lat.toFixed(8)));
        form.setValue("longitud", Number(pos.lng.toFixed(8)));
      });

      // Capturar clic en el mapa
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        form.setValue("latitud", Number(lat.toFixed(8)));
        form.setValue("longitud", Number(lng.toFixed(8)));
      });

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;
    } else {
      // Si cambian los valores externamente (ej. Localización actual), reposicionamos el marcador
      const currentMarkerLatLng = markerInstanceRef.current.getLatLng();
      if (
        currentMarkerLatLng.lat !== latitudValue ||
        currentMarkerLatLng.lng !== longitudValue
      ) {
        if (latitudValue && longitudValue) {
          markerInstanceRef.current.setLatLng([latitudValue, longitudValue]);
          mapInstanceRef.current.setView([latitudValue, longitudValue], 15);
        }
      }
    }
  }, [leafletLoaded, latitudValue, longitudValue]);

  // 3. Función para capturar coordenadas GPS desde el navegador
  const obtenerCoordenadasGps = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }

    toast.info("Obteniendo ubicación del dispositivo...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        form.setValue("latitud", Number(latitude.toFixed(8)));
        form.setValue("longitud", Number(longitude.toFixed(8)));
        toast.success("Ubicación GPS capturada con éxito");
      },
      (error) => {
        console.error("Error al obtener geolocalización:", error);
        toast.error(`No se pudo obtener la ubicación: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Cargar rutas al montar
  useEffect(() => {
    setCargandoRutas(true);
    listarRutas()
      .then(setRutas)
      .catch(() => {
        toast.error("No se pudieron cargar las rutas");
        setRutas([]);
      })
      .finally(() => setCargandoRutas(false));
  }, []);

  // ── Lógica de submit ────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    setFase("subiendo_documentos");
    setProgresoSubida(0);

    // Detectar cuántos archivos hay que subir para calcular progreso
    const archivosASubir = Object.values(archivos).filter(Boolean);
    const totalArchivos = archivosASubir.length;
    let subidosCount = 0;

    let urlsDocumentos: Partial<Record<TipoDocumento, string>> = {};

    // ── PASO 1: Subir documentos al Storage ──────────────────────────────────
    if (totalArchivos > 0) {
      try {
        // Subir cada archivo secuencialmente para poder actualizar el progreso
        for (const [tipo, file] of Object.entries(archivos) as [
          TipoDocumento,
          File | null,
        ][]) {
          if (!file) continue;

          // Validar tamaño antes de subir
          if (file.size > ARCHIVOS_MAX_BYTES) {
            throw new Error(
              `El archivo "${file.name}" supera el límite de ${ARCHIVOS_MAX_MB} MB`,
            );
          }

          const resultado = await subirDocumentosCliente(values.cedula, {
            [tipo]: file,
          });
          urlsDocumentos = { ...urlsDocumentos, ...resultado };

          subidosCount++;
          setProgresoSubida(Math.round((subidosCount / totalArchivos) * 80));
        }
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : "Error desconocido al subir archivos";
        toast.error("Fallo al subir documentos", {
          description: msg,
          duration: 6000,
        });
        setFase("idle");
        setProgresoSubida(0);
        return; // ← Detener: NO insertar en BD
      }
    }

    // ── PASO 2: Insertar en la base de datos ─────────────────────────────────
    setFase("guardando_cliente");
    setProgresoSubida(90);

    try {
      await crearCliente({
        ...values,
        telefono_alterno: values.telefono_alterno || null,
        lugar_trabajo: values.lugar_trabajo || null,
        telefono_trabajo: values.telefono_trabajo || null,
        foto_cliente_url: urlsDocumentos.foto ?? null,
        foto_cedula_frente_url: urlsDocumentos.cedula_frente ?? null,
        foto_cedula_respaldo_url: urlsDocumentos.cedula_respaldo ?? null,
        foto_casa_1_url: urlsDocumentos.foto_casa_1 ?? null,
        foto_casa_2_url: urlsDocumentos.foto_casa_2 ?? null,
        latitud: values.latitud ?? null,
        longitud: values.longitud ?? null,
      });

      setFase("completado");
      setProgresoSubida(100);

      toast.success("✅ Cliente registrado correctamente", {
        description: `${values.nombres} ${values.apellidos} fue agregado a la ruta.`,
        duration: 4000,
      });

      // Reset y navegar después de un breve delay
      setTimeout(() => {
        form.reset(VALORES_INICIALES);
    setArchivos({ foto: null, cedula_frente: null, cedula_respaldo: null, foto_casa_1: null, foto_casa_2: null });
        setFase("idle");
        setProgresoSubida(0);
        navigate({ to: "/clientes" });
      }, 800);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Error al guardar el cliente";
      toast.error("No se pudo registrar el cliente", {
        description: msg,
        duration: 6000,
      });
      setFase("idle");
      setProgresoSubida(0);
    }
  };

  const resetForm = () => {
    form.reset(VALORES_INICIALES);
    setArchivos({ foto: null, cedula_frente: null, cedula_respaldo: null, foto_casa_1: null, foto_casa_2: null });
    setFase("idle");
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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
          {/* ── Barra de progreso de subida ── */}
          {enviando && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <p className="text-sm font-medium text-primary">
                    {fase === "subiendo_documentos"
                      ? "Subiendo documentos al servidor…"
                      : "Guardando cliente en la base de datos…"}
                  </p>
                </div>
                <Progress value={progresoSubida} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground text-right">
                  {progresoSubida}%
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── 1. DATOS PERSONALES ── */}
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
                      <Input
                        placeholder="Juan Carlos"
                        disabled={enviando}
                        {...field}
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
                        placeholder="Pérez Gómez"
                        disabled={enviando}
                        {...field}
                      />
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
                        disabled={enviando}
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
                        disabled={enviando}
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
                        disabled={enviando}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── 2. UBICACIÓN Y TRABAJO ── */}
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
                      <Input
                        placeholder="Calle 5 # 4-23"
                        disabled={enviando}
                        {...field}
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
                        placeholder="Centro"
                        disabled={enviando}
                        {...field}
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
                        placeholder="Muzo"
                        disabled={enviando}
                        {...field}
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
                        placeholder="Opcional"
                        disabled={enviando}
                        {...field}
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
                        inputMode="tel"
                        placeholder="Opcional"
                        disabled={enviando}
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
                      disabled={enviando || cargandoRutas}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              cargandoRutas
                                ? "Cargando rutas…"
                                : "Selecciona una ruta"
                            }
                          />
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

          {/* ── 2.5. UBICACIÓN GPS ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle>Coordenadas GPS</CardTitle>
                  <CardDescription>
                    Geolocalización del cliente para optimizar la ruta de cobranza
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <FormField
                  control={form.control}
                  name="latitud"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Latitud</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.00000001"
                          placeholder="Ej: 5.5310"
                          disabled={enviando}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitud"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Longitud</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.00000001"
                          placeholder="Ej: -74.1080"
                          disabled={enviando}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={obtenerCoordenadasGps}
                    disabled={enviando}
                    className="w-full sm:w-auto h-9 text-xs font-semibold"
                  >
                    Obtener mi ubicación actual
                  </Button>
                </div>
              </div>

              {/* Contenedor del mapa de Leaflet */}
              <div 
                ref={mapContainerRef} 
                className="h-60 w-full rounded-lg border border-border bg-muted/30 overflow-hidden relative z-10" 
                style={{ minHeight: "240px" }}
              />
              <p className="text-2xs text-muted-foreground italic">
                * Puedes hacer clic en cualquier lugar del mapa o arrastrar el marcador para corregir la posición exacta de visita del cliente.
              </p>
            </CardContent>
          </Card>

          {/* ── 3. DOCUMENTACIÓN ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle>Documentación fotográfica</CardTitle>
                  <CardDescription>
                    Los archivos se suben automáticamente al guardar · Máx{" "}
                    {ARCHIVOS_MAX_MB} MB por imagen · Solo imágenes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FileFieldUI
                id="foto-cliente"
                label="Foto del cliente"
                file={archivos.foto}
                disabled={enviando}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, foto: file }))
                }
                onClear={() =>
                  setArchivos((prev) => ({ ...prev, foto: null }))
                }
              />
              <FileFieldUI
                id="cedula-frente"
                label="Cédula (frente)"
                file={archivos.cedula_frente}
                disabled={enviando}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, cedula_frente: file }))
                }
                onClear={() =>
                  setArchivos((prev) => ({ ...prev, cedula_frente: null }))
                }
              />
              <FileFieldUI
                id="cedula-respaldo"
                label="Cédula (respaldo)"
                file={archivos.cedula_respaldo}
                disabled={enviando}
                onChange={(file) =>
                  setArchivos((prev) => ({
                    ...prev,
                    cedula_respaldo: file,
                  }))
                }
                onClear={() =>
                  setArchivos((prev) => ({
                    ...prev,
                    cedula_respaldo: null,
                  }))
                }
              />
              {/* Fotos de la casa — segunda fila */}
              <FileFieldUI
                id="foto-casa-1"
                label="Foto de la casa (1)"
                file={archivos.foto_casa_1}
                disabled={enviando}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, foto_casa_1: file }))
                }
                onClear={() =>
                  setArchivos((prev) => ({ ...prev, foto_casa_1: null }))
                }
              />
              <FileFieldUI
                id="foto-casa-2"
                label="Foto de la casa (2)"
                file={archivos.foto_casa_2}
                disabled={enviando}
                onChange={(file) =>
                  setArchivos((prev) => ({ ...prev, foto_casa_2: file }))
                }
                onClear={() =>
                  setArchivos((prev) => ({ ...prev, foto_casa_2: null }))
                }
              />
            </CardContent>
          </Card>

          {/* ── Acciones ── */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={enviando}
              onClick={resetForm}
            >
              Limpiar
            </Button>
            <Button
              type="submit"
              disabled={enviando}
              className="min-w-[160px]"
            >
              {enviando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {ETIQUETAS_FASE[fase]}
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

// ─── Componente FileFieldUI ───────────────────────────────────────────────────

interface FileFieldUIProps {
  id: string;
  label: string;
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
  onClear: () => void;
}

function FileFieldUI({
  id,
  label,
  file,
  disabled,
  onChange,
  onClear,
}: FileFieldUIProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null);
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Etiqueta nativa — no depende del contexto de FormField */}
      <label
        htmlFor={id}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
      </label>

      {file ? (
        /* Vista previa cuando hay archivo seleccionado */
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </p>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                aria-label="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Miniatura para imágenes */}
          <img
            src={URL.createObjectURL(file)}
            alt={label}
            className="mt-2 h-20 w-full rounded object-cover"
          />
        </div>
      ) : (
        /* Zona de drop / click cuando no hay archivo */
        <label
          htmlFor={id}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 ${
            disabled ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium text-foreground">
              Seleccionar imagen
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WEBP · máx {ARCHIVOS_MAX_MB} MB
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Opcional
          </Badge>
        </label>
      )}

      {/* Input oculto — accesible con el label htmlFor={id} de arriba */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
    </div>
  );
}
