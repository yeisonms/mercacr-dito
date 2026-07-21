import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { toPng, toBlob } from 'html-to-image';
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
  List,
  Map,
  Download,
  Share2,
  MessageCircle,
  CalendarIcon,
  GripVertical,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  obtenerCreditosCobro,
  registrarRecaudo,
  actualizarSecuenciaRuta,
  type CreditoCobro,
} from "@/services/recaudoService";
import { registrarPromesaPago } from "@/services/gestionService";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

export interface ReciboData {
  fecha: string;
  clienteNombre: string;
  abono: number;
  totalCredito: number;
  saldoPendiente: number;
  telefono: string;
}

// ─── Esquema de Validación Zod ──────────────────────────────────────────────

const recaudoSchema = z.object({
  valor_recibido: z.coerce
    .number({ invalid_type_error: "El valor recibido debe ser un número" })
    .min(1, "El valor recibido debe ser mayor a 0"),
  metodo_pago: z.enum(["Efectivo", "Transferencia"]),
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

/**
 * Calcula la distancia euclidiana entre dos puntos GPS.
 * Para distancias cortas dentro de una ciudad es suficientemente preciso.
 */
function distanciaKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Algoritmo del Vecino Más Cercano (Nearest Neighbor).
 * Ordena los clientes partiendo desde el punto de inicio (cobrador)
 * visitando siempre el cliente más cercano no visitado.
 * Solo considera clientes que tienen coordenadas GPS.
 */
function optimizarRuta(
  clientes: CreditoCobro[],
  inicio: [number, number]
): CreditoCobro[] {
  const conGps = clientes.filter(
    (c) => c.cliente.latitud !== null && c.cliente.longitud !== null
  );
  if (conGps.length === 0) return clientes;

  const sinGps = clientes.filter(
    (c) => c.cliente.latitud === null || c.cliente.longitud === null
  );

  const visitados = new Set<string>();
  const rutaOptima: CreditoCobro[] = [];
  let posActual = inicio;

  while (visitados.size < conGps.length) {
    let menorDistancia = Infinity;
    let siguiente: CreditoCobro | null = null;

    for (const cliente of conGps) {
      if (visitados.has(cliente.id)) continue;
      const dist = distanciaKm(
        posActual[0], posActual[1],
        Number(cliente.cliente.latitud!),
        Number(cliente.cliente.longitud!)
      );
      if (dist < menorDistancia) {
        menorDistancia = dist;
        siguiente = cliente;
      }
    }

    if (!siguiente) break;
    visitados.add(siguiente.id);
    rutaOptima.push(siguiente);
    posActual = [
      Number(siguiente.cliente.latitud!),
      Number(siguiente.cliente.longitud!),
    ];
  }

// Los clientes sin GPS van al final
  return [...rutaOptima, ...sinGps];
}

// ─── Sub-Componente de Tarjeta Arrastrable ────────────────────────────────────

function SortableCreditoCard({ 
  item, 
  config, 
  onClick,
  disabled
}: { 
  item: CreditoCobro; 
  config: any; 
  onClick: () => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden shadow-xs transition-all duration-100 border",
        isDragging 
          ? "border-primary/50 ring-2 ring-primary/20 scale-[1.02] shadow-md relative" 
          : "border-border/60 hover:border-primary/40"
      )}
    >
      <CardContent className="p-0 flex items-stretch">
        {/* Grip Handle exclusivo (solo se muestra si no está deshabilitado por búsqueda) */}
        {!disabled && (
          <div 
            {...attributes} 
            {...listeners} 
            className="w-10 bg-muted/40 hover:bg-muted flex items-center justify-center cursor-grab active:cursor-grabbing border-r border-border/40 shrink-0 touch-none"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground/60" />
          </div>
        )}
        
        {/* Contenido de la Tarjeta clickeable */}
        <div className="flex-1 p-4 space-y-3 cursor-pointer active:scale-[0.99]" onClick={onClick}>
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
              className={cn("text-2xs px-2 py-0.5 shrink-0", config.badgeClass)}
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
              onClick={(e) => e.stopPropagation()}
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
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────

function CobranzaPage() {
  const { perfil } = useAuth();
  const navigate = useNavigate();

  // Guard para Auxiliar
  useEffect(() => {
    if (perfil && perfil.rol === "Auxiliar") {
      navigate({ to: "/", replace: true });
    }
  }, [perfil, navigate]);

  const queryClient = useQueryClient();

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

  // Drag and Drop Logic
  const [localCreditos, setLocalCreditos] = useState<CreditoCobro[]>([]);

  useEffect(() => {
    if (creditos && !isLoading) {
      setLocalCreditos(creditos);
    }
  }, [creditos, isLoading]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requiere mover 5px para activar el drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = localCreditos.findIndex((item) => item.id === active.id);
      const newIndex = localCreditos.findIndex((item) => item.id === over.id);
      
      const newArray = arrayMove(localCreditos, oldIndex, newIndex);
      
      // UI Optimista
      setLocalCreditos(newArray);

      // Mutación a DB silenciosa
      const actualizaciones = newArray.map((item, idx) => ({
        clienteId: item.cliente.id,
        nuevaSecuencia: idx + 1,
      }));

      try {
        await actualizarSecuenciaRuta(actualizaciones);
      } catch (err: any) {
        toast.error("Error guardando el nuevo orden", {
          description: err.message,
        });
      }
    }
  };

  const [busqueda, setBusqueda] = useState("");
  const [creditoSeleccionado, setCreditoSeleccionado] = useState<CreditoCobro | null>(null);
  const [cuotaSugerida, setCuotaSugerida] = useState<number | null>(null);
  
  // Estado para el modal de Recibo Exitoso
  const [reciboData, setReciboData] = useState<ReciboData | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Estados para Promesa de Pago
  const [fechaCompromiso, setFechaCompromiso] = useState<Date | undefined>(undefined);
  const [observacionesGestion, setObservacionesGestion] = useState("");

  const promesaMutation = useMutation({
    mutationFn: registrarPromesaPago,
    onSuccess: () => {
      toast.success("Promesa registrada. El cliente se ha reprogramado en la ruta.");
      queryClient.invalidateQueries({ queryKey: ["creditos", "cobro"] });
      cerrarDrawer();
    },
    onError: (error: any) => {
      console.error("Error promesa:", error);
      toast.error(error.message || "Error al registrar la promesa");
    }
  });

  // Estados del archivo de foto
  const [fotoSoporte, setFotoSoporte] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Vista activa: "lista" | "mapa"
  const [vistaActiva, setVistaActiva] = useState<"lista" | "mapa">("lista");

  // Geolocalización y mapa
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const cobradorMarkerRef = useRef<any>(null);
  const [posicionCobrador, setPosicionCobrador] = useState<[number, number] | null>(null);

  // Cargar scripts de Leaflet (solo cliente, SSR safe)
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

    // Obtener ubicación actual del cobrador
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosicionCobrador([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // Muzo como fallback
          setPosicionCobrador([5.5310, -74.1080]);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setPosicionCobrador([5.5310, -74.1080]);
    }

    return () => {
      // Limpieza al desmontar
      if (intervalId) clearInterval(intervalId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
        polylineRef.current = null;
        cobradorMarkerRef.current = null;
      }
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<RecaudoFormValues>({
    resolver: zodResolver(recaudoSchema),
    defaultValues: {
      valor_recibido: undefined,
      metodo_pago: "Efectivo",
      observaciones: "",
    },
  });

  // 3. Mutación para registrar el pago
  const mutation = useMutation({
    mutationFn: (values: {
      creditoId: string;
      valorRecibido: number;
      metodoPago: "Efectivo" | "Transferencia";
      fotoDinero?: File | null;
      observaciones?: string;
    }) => registrarRecaudo(values),
    onSuccess: (data, variables) => {
      if (variables.metodoPago === "Efectivo") {
        toast.success("Pago en efectivo procesado y aprobado");
      } else {
        toast.success("Pago enviado a revisión");
      }
      queryClient.invalidateQueries({ queryKey: ["creditos", "cobro"] });
      
      // Preparar datos para el recibo (si había crédito seleccionado)
      if (creditoSeleccionado) {
        setReciboData({
          fecha: new Date().toISOString().split("T")[0],
          clienteNombre: `${creditoSeleccionado.cliente.nombres} ${creditoSeleccionado.cliente.apellidos}`,
          abono: variables.valorRecibido,
          totalCredito: creditoSeleccionado.valor_credito || 0,
          saldoPendiente: creditoSeleccionado.saldo_pendiente - variables.valorRecibido,
          telefono: creditoSeleccionado.cliente.telefono_principal || "",
        });
      }
      
      cerrarDrawer();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar el pago");
    },
  });

  // 4. Filtrar clientes localmente por nombre, cédula o barrio
  const creditosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return localCreditos;
    return localCreditos.filter(
      (item) =>
        item.cliente.nombres.toLowerCase().includes(q) ||
        item.cliente.apellidos.toLowerCase().includes(q) ||
        item.cliente.cedula.includes(q) ||
        item.cliente.barrio.toLowerCase().includes(q)
    );
  }, [localCreditos, busqueda]);

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

  // Efecto para inicializar y actualizar el mapa Leaflet
  useEffect(() => {
    if (!leafletLoaded || vistaActiva !== "mapa" || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Centro inicial: ubicación del cobrador o del primer cliente de la ruta
    let centerLat = 5.5310;
    let centerLng = -74.1080;

    if (posicionCobrador) {
      centerLat = posicionCobrador[0];
      centerLng = posicionCobrador[1];
    } else {
      const primerClienteGps = creditosFiltrados.find(
        (c) => c.cliente.latitud !== null && c.cliente.longitud !== null
      );
      if (primerClienteGps) {
        centerLat = primerClienteGps.cliente.latitud!;
        centerLng = primerClienteGps.cliente.longitud!;
      }
    }

    // Si el mapa aún no existe, lo inicializamos
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(
        [centerLat, centerLng],
        14
      );

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Evento global para capturar clics en botones generados por HTML dentro de popups
      map.on("popupopen", (e: any) => {
        const popup = e.popup;
        const container = popup.getElement();
        if (container) {
          const btn = container.querySelector(".btn-cobrar-mapa");
          if (btn) {
            const idCredito = btn.getAttribute("data-credito-id");
            btn.addEventListener("click", () => {
              const credito = creditosFiltrados.find((c) => c.id === idCredito);
              if (credito) {
                abrirDrawer(credito);
                map.closePopup();
              }
            });
          }
        }
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Limpiar marcadores antiguos
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (cobradorMarkerRef.current) {
      cobradorMarkerRef.current.remove();
      cobradorMarkerRef.current = null;
    }

    // 1. Dibujar ubicación del cobrador (Punto azul con halo)
    if (posicionCobrador) {
      // Halo externo
      L.circle(posicionCobrador, {
        radius: 35,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.25,
        weight: 1
      }).addTo(map);

      // Círculo central
      const markerCobrador = L.circleMarker(posicionCobrador, {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 1
      }).addTo(map);

      markerCobrador.bindPopup("<strong class='text-xs'>Mi ubicación actual</strong>");
      cobradorMarkerRef.current = markerCobrador;
    }

    // 2. Optimizar orden de visitas con Nearest Neighbor
    const puntoInicio: [number, number] = posicionCobrador ?? [5.5310, -74.1080];
    const clientesOrdenados = optimizarRuta(creditosFiltrados, puntoInicio);

    // 3. Dibujar marcadores en el ORDEN ÓPTIMO
    const latlngsRuta: [number, number][] = [];

    // Si hay posición del cobrador, incluirla como primer punto de la polilínea
    if (posicionCobrador) {
      latlngsRuta.push(posicionCobrador);
    }

    clientesOrdenados.forEach((item, index) => {
      if (item.cliente.latitud !== null && item.cliente.longitud !== null) {
        const lat = Number(item.cliente.latitud);
        const lng = Number(item.cliente.longitud);
        latlngsRuta.push([lat, lng]);

        // Número de visita en el orden óptimo (1-based)
        const numeroVisita = index + 1;

        // Color según estado del crédito
        let colorMarker = "#10b981"; // Al día
        if (item.estado === "En mora") colorMarker = "#ef4444";
        else if (item.estado === "Próximo a vencer") colorMarker = "#f59e0b";

        // Calcular distancia desde el punto anterior
        const puntoAnterior = index === 0
          ? puntoInicio
          : [
              Number(clientesOrdenados[index - 1].cliente.latitud!),
              Number(clientesOrdenados[index - 1].cliente.longitud!),
            ] as [number, number];
        const dist = distanciaKm(
          puntoAnterior[0], puntoAnterior[1], lat, lng
        ).toFixed(2);

        // Marcador numerado según orden óptimo
        const customIcon = L.divIcon({
          className: "custom-div-icon",
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
                   <div style="position:absolute;height:32px;width:32px;border-radius:50%;opacity:0.18;background-color:${colorMarker};"></div>
                   <div style="height:26px;width:26px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:white;background-color:${colorMarker};box-shadow:0 2px 6px rgba(0,0,0,0.35);">
                     ${numeroVisita}
                   </div>
                 </div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        const popupContent = `
          <div style="padding:6px;min-width:165px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">
              ${numeroVisita}. ${item.cliente.nombres} ${item.cliente.apellidos}
            </div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">📍 ${item.cliente.barrio}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">📏 ~${dist} km desde parada anterior</div>
            <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:6px;">
              Saldo: ${formatearMoneda(item.saldo_pendiente)}
            </div>
            <button 
              type="button" 
              class="btn-cobrar-mapa"
              data-credito-id="${item.id}"
              style="background:#059669;color:white;font-weight:700;padding:6px 10px;border-radius:8px;font-size:11px;width:100%;text-align:center;cursor:pointer;border:0;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
              💰 Registrar Pago
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);
        markersRef.current.push(marker);
      }
    });

    // 4. Dibujar polilínea de la ruta ÓPTIMA
    const soloClientes = latlngsRuta.slice(posicionCobrador ? 1 : 0);

    if (soloClientes.length > 1) {
      // Línea principal de la ruta
      const polyline = L.polyline(latlngsRuta, {
        color: "#6366f1",   // Indigo — diferente al verde de los marcadores para distinguir
        weight: 3.5,
        opacity: 0.75,
        dashArray: "8, 5",
      }).addTo(map);

      // Flecha de dirección sobre la polilínea (usando decoradores si Leaflet los soporta)
      polylineRef.current = polyline;

      // Auto-fit mostrando toda la ruta óptima
      map.fitBounds(polyline.getBounds(), { padding: [45, 45] });
    } else if (soloClientes.length === 1) {
      map.setView(soloClientes[0], 15);
    }
  }, [leafletLoaded, vistaActiva, creditosFiltrados, posicionCobrador]);

  // 6. Abrir y cerrar panel
  const abrirDrawer = async (credito: CreditoCobro) => {
    setCreditoSeleccionado(credito);
    removerFoto();
    
    // Sugerencia Automática de Cuota
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("cuotas")
          .select("saldo_cuota")
          .eq("credito_id", credito.id)
          .in("estado", ["Pendiente", "Parcial"])
          .order("numero_cuota", { ascending: true })
          .limit(1)
          .single();

        if (!error && data) {
          const valor = Number(data.saldo_cuota);
          setCuotaSugerida(valor);
          reset({
            valor_recibido: valor,
            metodo_pago: "Efectivo",
            observaciones: "",
          });
          return;
        }
      } catch (err) {
        console.error("Error obteniendo cuota sugerida:", err);
      }
    }
    
    setCuotaSugerida(null);
    reset({
      valor_recibido: undefined,
      metodo_pago: "Efectivo",
      observaciones: "",
    });
  };

  const cerrarDrawer = () => {
    setCreditoSeleccionado(null);
    setCuotaSugerida(null);
    setFechaCompromiso(undefined);
    setObservacionesGestion("");
    reset();
    removerFoto();
  };

  const onSubmit = (values: RecaudoFormValues) => {
    if (!creditoSeleccionado) return;

    if (values.metodo_pago === "Transferencia" && !fotoSoporte) {
      toast.error("La foto del comprobante es obligatoria para Transferencia.");
      return;
    }

    mutation.mutate({
      creditoId: creditoSeleccionado.id,
      valorRecibido: values.valor_recibido,
      metodoPago: values.metodo_pago,
      fotoDinero: fotoSoporte,
      observaciones: values.observaciones,
    });
  };

  const onGuardarPromesa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditoSeleccionado || !posicionCobrador) return;
    if (!fechaCompromiso) {
      toast.error("Debes seleccionar una fecha de compromiso.");
      return;
    }
    if (!observacionesGestion.trim()) {
      toast.error("Debes escribir una observación o motivo de la promesa.");
      return;
    }

    promesaMutation.mutate({
      clienteId: creditoSeleccionado.cliente.id,
      creditoId: creditoSeleccionado.id,
      cobradorId: "52709375-28fd-4129-af98-8bc7e0536025", // Hardcoded for demo/Módulo 3, must come from Auth Context
      fechaCompromiso: format(fechaCompromiso, "yyyy-MM-dd"),
      observaciones: observacionesGestion,
    });
  };

  const descargarRecibo = async () => {
    if (!ticketRef.current || !reciboData) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Recibo_Mercacredito_${reciboData.clienteNombre.replace(/\s+/g, "_")}.png`;
      link.click();
    } catch (err) {
      console.error("Error al generar la imagen:", err);
      toast.error("Error al descargar el recibo");
    }
  };

  const compartirRecibo = async () => {
    if (!ticketRef.current || !reciboData) return;
    
    try {
      const blob = await toBlob(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      if (!blob) throw new Error("No se pudo generar la imagen para compartir");

      const file = new File([blob], `Recibo_Mercacredito_${reciboData.clienteNombre.replace(/\s+/g, "_")}.png`, { type: blob.type });
      const texto = `Comprobante de Pago Mercacrédito\nCliente: ${reciboData.clienteNombre}\nAbono: $${reciboData.abono.toLocaleString()}\nSaldo Pendiente: $${reciboData.saldoPendiente.toLocaleString()}`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file]
        });
      } else {
        toast.info("Compartir imágenes directamente no está soportado en este dispositivo/navegador. Utiliza la opción de descargar.");
      }
    } catch (err) {
      console.error("Error al compartir:", err);
      toast.error("Hubo un error al intentar compartir el recibo.");
    }
  };

  const enviarWhatsApp = () => {
    if (!reciboData) return;
    const { clienteNombre, abono, saldoPendiente, telefono } = reciboData;
    let tel = telefono.replace(/\D/g, "");
    if (!tel.startsWith("57") && tel.length === 10) {
      tel = "57" + tel;
    }
    const mensaje = `Hola *${clienteNombre}*, confirmamos el pago de tu cuota con *Mercacrédito*. Abono: *$${abono.toLocaleString()}*. Tu saldo pendiente es: *$${saldoPendiente.toLocaleString()}*. ¡Gracias por tu pago!`;
    const encoded = encodeURIComponent(mensaje);
    window.open(`https://wa.me/${tel}?text=${encoded}`, "_blank");
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

        {/* Selector de Vista: Lista vs Mapa */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl">
            <Button
              type="button"
              variant={vistaActiva === "lista" ? "default" : "ghost"}
              onClick={() => setVistaActiva("lista")}
              className="rounded-lg h-9 font-semibold text-xs gap-1.5"
            >
              <List className="h-4 w-4" />
              Lista de Cobro
            </Button>
            <Button
              type="button"
              variant={vistaActiva === "mapa" ? "default" : "ghost"}
              onClick={() => setVistaActiva("mapa")}
              className="rounded-lg h-9 font-semibold text-xs gap-1.5"
            >
              <Map className="h-4 w-4" />
              Mapa de Ruta
            </Button>
          </div>
        )}

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

        {/* Mapa interactivo de Cobranza */}
        {!isLoading && !isError && vistaActiva === "mapa" && (
          <div className="space-y-2">
            {/* Badge ruta óptima */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                  ✦ Ruta Óptima calculada
                </span>
                {posicionCobrador ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">· GPS activo</span>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">· Sin GPS (ubicación por defecto)</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {creditosFiltrados.filter(c => c.cliente.latitud !== null).length}/{creditosFiltrados.length} con GPS
              </span>
            </div>

            <div
              ref={mapContainerRef}
              className="h-[calc(100vh-300px)] min-h-[420px] w-full rounded-2xl border border-border/60 overflow-hidden relative z-10"
            />
            <p className="text-[10px] text-muted-foreground text-center italic">
              Los números indican el orden de visita optimizado partiendo desde tu ubicación. Toca un marcador para registrar el pago.
            </p>
          </div>
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
        {!isLoading && !isError && vistaActiva === "lista" && creditosFiltrados.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={busqueda === "" ? handleDragEnd : undefined}
          >
            <div className="space-y-3">
              <SortableContext 
                items={creditosFiltrados.map((c) => c.id)} 
                strategy={verticalListSortingStrategy}
                disabled={busqueda !== ""}
              >
                {creditosFiltrados.map((item) => {
                  const config = ESTADO_CONFIG[item.estado] || ESTADO_CONFIG["Al día"];
                  return (
                    <SortableCreditoCard
                      key={item.id}
                      item={item}
                      config={config}
                      onClick={() => abrirDrawer(item)}
                      disabled={busqueda !== ""}
                    />
                  );
                })}
              </SortableContext>
            </div>
          </DndContext>
        )}

        {/* Drawer de Registro de Pago (Vaul) */}
        <Drawer open={creditoSeleccionado !== null} onOpenChange={(open) => !open && cerrarDrawer()}>
          <DrawerContent className="max-w-md mx-auto">
            {creditoSeleccionado && (
              <Tabs defaultValue="pago" className="w-full">
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle className="text-lg font-bold">Gestión de Cobro</DrawerTitle>
                  <DrawerDescription className="text-xs text-muted-foreground">
                    Cliente: <strong>
                      {creditoSeleccionado.cliente.nombres}{" "}
                      {creditoSeleccionado.cliente.apellidos}
                    </strong>
                  </DrawerDescription>
                </DrawerHeader>

                <div className="px-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pago">Registrar Pago</TabsTrigger>
                    <TabsTrigger value="promesa">Registrar Promesa</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="pago">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="px-4 space-y-4 mt-2">
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

                  {/* Método de Pago */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center justify-center gap-2 border rounded-xl p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors text-center">
                        <input 
                          type="radio" 
                          value="Efectivo" 
                          className="accent-primary w-4 h-4"
                          {...register("metodo_pago")} 
                        />
                        <span className="text-sm font-medium">Efectivo</span>
                      </label>
                      <label className="flex items-center justify-center gap-2 border rounded-xl p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors text-center">
                        <input 
                          type="radio" 
                          value="Transferencia" 
                          className="accent-primary w-4 h-4"
                          {...register("metodo_pago")} 
                        />
                        <span className="text-sm font-medium">Transferencia</span>
                      </label>
                    </div>
                  </div>

                  {/* Input Valor Recibido */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="valor_recibido"
                      className="flex items-center justify-between text-xs font-bold text-foreground"
                    >
                      <span>Valor Recibido <span className="text-destructive">*</span></span>
                      {cuotaSugerida !== null && (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
                          Sugerida: {formatearMoneda(cuotaSugerida)}
                        </span>
                      )}
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
                    <label className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span>Foto del Comprobante / Dinero</span>
                      {watch("metodo_pago") === "Transferencia" ? (
                        <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">Obligatorio</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Opcional</span>
                      )}
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
              </TabsContent>

              <TabsContent value="promesa">
                <form onSubmit={onGuardarPromesa} className="space-y-4 mt-2">
                  <div className="px-4 space-y-4">
                    {/* Fecha de Compromiso */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">
                        Fecha de Compromiso
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal h-11 rounded-xl",
                              !fechaCompromiso && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fechaCompromiso ? format(fechaCompromiso, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarUI
                            mode="single"
                            selected={fechaCompromiso}
                            onSelect={setFechaCompromiso}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Observaciones */}
                    <div className="space-y-1.5">
                      <label htmlFor="observaciones_gestion" className="text-xs font-bold text-foreground block">
                        Motivo / Observaciones
                      </label>
                      <Textarea
                        id="observaciones_gestion"
                        placeholder="Ej: El cliente dice que le pagan el viernes..."
                        value={observacionesGestion}
                        onChange={(e) => setObservacionesGestion(e.target.value)}
                        className="min-h-[100px] resize-none text-sm rounded-lg"
                      />
                    </div>
                  </div>

                  <DrawerFooter className="pt-2 gap-2">
                    <Button
                      type="submit"
                      disabled={promesaMutation.isPending}
                      className="h-11 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {promesaMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>Guardar Gestión</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cerrarDrawer}
                      disabled={promesaMutation.isPending}
                      className="h-10 text-xs rounded-xl"
                    >
                      Cancelar
                    </Button>
                  </DrawerFooter>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </DrawerContent>
        </Drawer>

        {/* Modal de Éxito / Recibo (Ticket) */}
        <Dialog open={reciboData !== null} onOpenChange={(open) => !open && setReciboData(null)}>
          <DialogContent className="max-w-sm rounded-2xl mx-auto bg-white p-6 shadow-2xl overflow-hidden [&>button]:hidden">
            {reciboData && (
              <div className="flex flex-col items-center space-y-6">
                
                {/* Contenedor completo para descargar (incluye logo, check y body) */}
                <div ref={ticketRef} className="flex flex-col items-center space-y-4 bg-white p-4 pb-2 w-full">
                  {/* Header */}
                  <div className="flex flex-col items-center text-center space-y-3">
                    <img 
                      src="/logo.jpeg" 
                      alt="Logo Mercacrédito" 
                      className="h-16 w-auto object-contain mx-auto"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-foreground tracking-tight">¡Pago Registrado con Éxito!</h2>
                      <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest">Mercacrédito</p>
                    </div>
                  </div>

                  {/* Ticket Body */}
                  <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha</span>
                      <span className="text-sm font-bold text-foreground">{reciboData.fecha}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</span>
                      <span className="text-sm font-bold text-foreground text-right max-w-[150px] truncate">{reciboData.clienteNombre}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200 bg-emerald-50/50 -mx-2 px-2 py-1 rounded">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Abono Realizado</span>
                      <span className="text-base font-black text-emerald-600">${reciboData.abono.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">Total del Crédito</span>
                      <span className="text-sm font-medium text-foreground">${reciboData.totalCredito.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Saldo Pendiente</span>
                      <span className="text-sm font-black text-amber-600">${reciboData.saldoPendiente.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="w-full space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="w-full text-xs font-semibold h-11 rounded-xl" onClick={descargarRecibo}>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar
                    </Button>
                    <Button variant="outline" className="w-full text-xs font-semibold h-11 rounded-xl" onClick={compartirRecibo}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Compartir
                    </Button>
                  </div>
                  <Button 
                    className="w-full text-sm font-bold h-12 rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 text-white flex items-center justify-center gap-2 shadow-sm"
                    onClick={enviarWhatsApp}
                  >
                    <MessageCircle className="w-5 h-5" />
                    Enviar Recibo por WhatsApp
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-xs font-semibold h-10 text-muted-foreground"
                    onClick={() => setReciboData(null)}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
