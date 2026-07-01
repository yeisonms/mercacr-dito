import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Map,
  Plus,
  GripVertical,
  Save,
  Loader2,
  Users,
  MapPin,
  DollarSign,
  Info,
  Layers,
  ArrowRight,
  ClipboardList,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  listarCobradores,
  listarRutasConCobradores,
  obtenerClientesPorRuta,
  crearRuta,
  guardarSecuenciasClientes,
  type ClienteRuta,
} from "@/services/rutaService";

// ─── Definición de Ruta ───────────────────────────────────────────────────────

export const Route = createFileRoute("/rutas")({
  head: () => ({
    meta: [
      { title: "Gestor de Rutas — Mercacrédito" },
      {
        name: "description",
        content: "Gestión de cobradores y secuencias de visitas de rutas de cobranza.",
      },
    ],
  }),
  component: GestorRutasPage,
});

// ─── Componente Principal ────────────────────────────────────────────────────

function GestorRutasPage() {
  const queryClient = useQueryClient();

  // Estados locales
  const [selectedRutaId, setSelectedRutaId] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [listaClientes, setListaClientes] = useState<ClienteRuta[]>([]);
  const [haCambiado, setHaCambiado] = useState(false);

  // Estados de Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Estados para el Formulario de Nueva Ruta (React 19 ref loop fix)
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCobradorId, setNuevoCobradorId] = useState("");
  const [formErrors, setFormErrors] = useState<{ codigo_ruta?: string; nombre_ruta?: string }>({});

  const limpiarFormulario = () => {
    setNuevoCodigo("");
    setNuevoNombre("");
    setNuevoCobradorId("");
    setFormErrors({});
  };

  // 1. Cargar Cobradores
  const { data: cobradores } = useQuery({
    queryKey: ["rutas", "cobradores"],
    queryFn: listarCobradores,
  });

  // 2. Cargar Rutas
  const { data: rutas, isLoading: isLoadingRutas } = useQuery({
    queryKey: ["rutas", "lista"],
    queryFn: listarRutasConCobradores,
  });

  // Seleccionar la primera ruta por defecto si existe
  useEffect(() => {
    if (rutas && rutas.length > 0 && !selectedRutaId) {
      setSelectedRutaId(rutas[0].id);
    }
  }, [rutas, selectedRutaId]);

  // 3. Cargar Clientes de la ruta seleccionada
  const { data: clientesQuery, isLoading: isLoadingClientes, refetch: refetchClientes } = useQuery({
    queryKey: ["rutas", "clientes", selectedRutaId],
    queryFn: () => obtenerClientesPorRuta(selectedRutaId),
    enabled: !!selectedRutaId,
  });

  // Sincronizar estado local al cargar consulta
  useEffect(() => {
    if (clientesQuery) {
      setListaClientes(clientesQuery);
      setHaCambiado(false);
    }
  }, [clientesQuery]);

  // 5. Mutaciones
  const createRutaMutation = useMutation({
    mutationFn: (values: { codigo: string; nombre: string; cobradorId: string | null }) =>
      crearRuta(values.codigo, values.nombre, values.cobradorId),
    onSuccess: (nuevaRuta) => {
      setIsCreateDialogOpen(false);
      limpiarFormulario();
      
      // Retrasar el toast y la actualización de ruta para permitir que el modal se desmonte primero
      setTimeout(() => {
        toast.success("Ruta de cobro creada exitosamente");
        queryClient.invalidateQueries({ queryKey: ["rutas", "lista"] });
        setSelectedRutaId(nuevaRuta.id);
      }, 100);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear la ruta");
    },
  });

  const saveOrderMutation = useMutation({
    mutationFn: (variables: { id: string; secuencia_visita: number }[]) =>
      guardarSecuenciasClientes(variables),
    onSuccess: () => {
      toast.success("Secuencias de visita guardadas correctamente");
      setHaCambiado(false);
      queryClient.invalidateQueries({ queryKey: ["rutas", "clientes", selectedRutaId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al guardar el nuevo orden");
    },
  });

  // Manejo de Sumisiones
  const handleCrearRutaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { codigo_ruta?: string; nombre_ruta?: string } = {};

    const cod = nuevoCodigo.trim();
    const nom = nuevoNombre.trim();

    if (!cod) {
      errors.codigo_ruta = "El código corto es obligatorio";
    } else if (cod.length < 2 || cod.length > 10) {
      errors.codigo_ruta = "El código debe tener entre 2 y 10 caracteres";
    } else if (!/^[a-zA-Z0-9]+$/.test(cod)) {
      errors.codigo_ruta = "El código solo debe tener caracteres alfanuméricos";
    }

    if (!nom) {
      errors.nombre_ruta = "El nombre de la ruta es obligatorio";
    } else if (nom.length < 3) {
      errors.nombre_ruta = "El nombre debe tener al menos 3 caracteres";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    createRutaMutation.mutate({
      codigo: cod,
      nombre: nom,
      cobradorId: nuevoCobradorId || null,
    });
  };

  const handleGuardarOrden = () => {
    const secuenciasInput = listaClientes.map((c) => ({
      id: c.id,
      secuencia_visita: c.secuencia_visita,
    }));
    saveOrderMutation.mutate(secuenciasInput);
  };

  // ─── Lógica de Drag & Drop Nativo (HTML5) ───────────────────────────────────

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Necesario para Firefox
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const items = [...listaClientes];
      // Remover el item arrastrado
      const [draggedItem] = items.splice(draggedIndex, 1);
      // Insertarlo en el nuevo índice
      items.splice(dragOverIndex, 0, draggedItem);

      // Recalcular la secuencia de visita (1-based index)
      const listaActualizada = items.map((item, idx) => ({
        ...item,
        secuencia_visita: idx + 1,
      }));

      setListaClientes(listaActualizada);
      setHaCambiado(true);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(valor);
  };

  const selectedRuta = (rutas || []).find((r) => r.id === selectedRutaId);

  return (
    <AppShell title="Gestor de Rutas" subtitle="Organización y ordenamiento de secuencias de visitas">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Selector y botón superior */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor="ruta-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Seleccionar Ruta Activa
              </Label>
              {isLoadingRutas ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <select
                  id="ruta-select"
                  value={selectedRutaId}
                  onChange={(e) => setSelectedRutaId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(rutas || []).map((ruta) => (
                    <option key={ruta.id} value={ruta.id}>
                      {ruta.nombre_ruta} ({ruta.codigo_ruta})
                    </option>
                  ))}
                  {(rutas || []).length === 0 && <option value="">No hay rutas creadas</option>}
                </select>
              )}
            </div>

            <div className="flex gap-2 self-end sm:self-center">
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-1.5 h-10 font-semibold rounded-lg text-sm">
                <Plus className="h-4.5 w-4.5" />
                Nueva Ruta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Panel de visualización de clientes de la ruta */}
        {selectedRutaId && (
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="border-b border-border/40 pb-4 bg-muted/15 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Map className="h-5 w-5 text-primary" />
                  Secuencia de Visitas — {selectedRuta?.nombre_ruta}
                </CardTitle>
                <CardDescription className="text-xs">
                  Cobrador asignado:{" "}
                  <strong>{selectedRuta?.cobrador?.nombre_completo || "Sin Asignar"}</strong>
                </CardDescription>
              </div>

              {/* Guardar Nuevo Orden (Visible cuando hay cambios) */}
              {haCambiado && (
                <Button
                  onClick={handleGuardarOrden}
                  disabled={saveOrderMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg h-9 text-xs gap-1.5 shadow-sm animate-pulse"
                >
                  {saveOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Guardar Nuevo Orden
                    </>
                  )}
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-4">
              {/* Loader */}
              {isLoadingClientes && (
                <div className="space-y-2 py-6">
                  {[1, 2, 3].map((n) => (
                    <Skeleton key={n} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {/* Sin Clientes */}
              {!isLoadingClientes && listaClientes.length === 0 && (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ruta sin clientes asignados</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                      Asigna esta ruta a tus clientes desde el panel de edición o creación de clientes.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista Drag & Drop */}
              {!isLoadingClientes && listaClientes.length > 0 && (
                <div className="space-y-2 relative">
                  {listaClientes.map((cliente, index) => {
                    const isDraggingItem = draggedIndex === index;
                    const isOverTarget = dragOverIndex === index;

                    return (
                      <div
                        key={cliente.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 p-4 rounded-xl border bg-card transition-all duration-200 cursor-grab select-none
                          ${isDraggingItem ? "opacity-40 border-dashed border-primary bg-primary/5" : "border-border/60"}
                          ${isOverTarget ? "border-primary bg-primary/5 scale-[1.01]" : ""}
                          hover:border-primary/30 hover:shadow-xs active:cursor-grabbing`}
                      >
                        {/* Control de arrastre */}
                        <div className="text-muted-foreground/60 shrink-0">
                          <GripVertical className="h-5 w-5" />
                        </div>

                        {/* Posición de visita (Secuencia) */}
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {cliente.secuencia_visita}
                        </div>

                        {/* Detalle del cliente */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-semibold text-foreground">
                              {cliente.nombres} {cliente.apellidos}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({cliente.codigo_consecutivo})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 text-muted-foreground/75" />
                            <span className="truncate">{cliente.barrio}</span>
                          </div>
                        </div>

                        {/* Saldo pendiente */}
                        <div className="text-right shrink-0">
                          <span className="text-2xs text-muted-foreground font-semibold block uppercase">
                            Saldo Pendiente
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {formatearMoneda(cliente.saldo_pendiente)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guía informativa de reordenamiento */}
        {selectedRutaId && listaClientes.length > 1 && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>
              Arrastra y suelta las tarjetas para reordenar la secuencia de visitas del cobrador.
              Recuerda guardar los cambios cuando termines.
            </span>
          </div>
        )}

        {/* Modal de Creación de Nueva Ruta */}
        {isCreateDialogOpen && (
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              limpiarFormulario();
            }
          }}>
            <DialogContent className="max-w-md">
              <form onSubmit={handleCrearRutaSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-primary" />
                    Nueva Ruta de Cobro
                  </DialogTitle>
                  <DialogDescription>
                    Crea una nueva ruta de cobro en el sistema asignándole un cobrador.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  {/* Código de Ruta */}
                  <div className="space-y-1.5">
                    <Label htmlFor="codigo_ruta" className="text-xs font-bold text-foreground">
                      Código corto <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="codigo_ruta"
                      placeholder="Ej. NOR, SUR, CENTRO"
                      value={nuevoCodigo}
                      onChange={(e) => setNuevoCodigo(e.target.value)}
                      className="h-10 uppercase rounded-lg"
                    />
                    {formErrors.codigo_ruta && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {formErrors.codigo_ruta}
                      </p>
                    )}
                  </div>

                  {/* Nombre de Ruta */}
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre_ruta" className="text-xs font-bold text-foreground">
                      Nombre de la Ruta <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nombre_ruta"
                      placeholder="Ej. Ruta Norte - Bello"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                    {formErrors.nombre_ruta && (
                      <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        {formErrors.nombre_ruta}
                      </p>
                    )}
                  </div>

                  {/* Cobrador Asignado */}
                  <div className="space-y-1.5">
                    <Label htmlFor="cobrador_id" className="text-xs font-bold text-foreground">
                      Asignar Cobrador (Opcional)
                    </Label>
                    <select
                      id="cobrador_id"
                      value={nuevoCobradorId}
                      onChange={(e) => setNuevoCobradorId(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">No asignar (Dejar libre)</option>
                      {(cobradores || []).map((cobrador) => (
                        <option key={cobrador.id} value={cobrador.id}>
                          {cobrador.nombre_completo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="submit"
                    disabled={createRutaMutation.isPending}
                    className="bg-primary text-primary-foreground font-semibold rounded-lg h-10 px-4 flex items-center justify-center gap-2"
                  >
                    {createRutaMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Ruta"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      limpiarFormulario();
                    }}
                    className="rounded-lg h-10"
                  >
                    Cancelar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
