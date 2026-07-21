import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Users,
  RefreshCw,
  UserX,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { descargarRespaldoExcel } from "@/services/exportService";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useClientes } from "@/hooks/use-clientes";
import type { Cliente, EstadoCliente } from "@/services/cliente.service";

// ─── Ruta ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Mercacrédito" },
      {
        name: "description",
        content: "Listado y búsqueda de clientes del ERP Mercacrédito.",
      },
    ],
  }),
  component: ClientesPage,
});

// ─── Badge de estado ──────────────────────────────────────────────────────────

const CONFIG_ESTADO: Record<
  EstadoCliente,
  { label: string; className: string }
> = {
  Activo: {
    label: "Activo",
    className:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400",
  },
  Moroso: {
    label: "Moroso",
    className:
      "bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/20 dark:text-red-400",
  },
  Judicial: {
    label: "Judicial",
    className:
      "bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/20 dark:text-amber-400",
  },
  Inactivo: {
    label: "Inactivo",
    className:
      "bg-muted text-muted-foreground border-border hover:bg-muted/80",
  },
  Finalizado: {
    label: "Finalizado",
    className:
      "bg-muted text-muted-foreground border-border hover:bg-muted/80",
  },
};

function EstadoBadge({ estado }: { estado: EstadoCliente }) {
  const config = CONFIG_ESTADO[estado] ?? CONFIG_ESTADO.Inactivo;
  return (
    <Badge
      variant="outline"
      className={`whitespace-nowrap text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}

// ─── Fila skeleton ────────────────────────────────────────────────────────────

function FilaSkeleton() {
  return (
    <TableRow>
      {[40, 160, 100, 110, 80, 70, 36].map((w, i) => (
        <TableCell key={i}>
          <Skeleton className={`h-4`} style={{ width: w }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EstadoVacio({ buscando }: { buscando: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <UserX className="h-8 w-8" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {buscando
            ? "Sin resultados para tu búsqueda"
            : "No hay clientes registrados"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {buscando
            ? "Prueba con otro nombre, cédula o código."
            : "Registra el primer cliente para comenzar."}
        </p>
      </div>
      {!buscando && (
        <Button asChild size="sm">
          <Link to="/clientes/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      )}
    </div>
  );
}

// ─── Menú de acciones por fila ────────────────────────────────────────────────

function AccionesMenu({ cliente }: { cliente: Cliente }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Acciones para ${cliente.nombres} ${cliente.apellidos}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {cliente.codigo_consecutivo}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            navigate({ to: "/clientes/$clienteId", params: { clienteId: cliente.id } })
          }
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            navigate({ to: "/clientes/$clienteId", params: { clienteId: cliente.id } })
          }
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


// ─── Página principal ─────────────────────────────────────────────────────────

function ClientesPage() {
  const { data: clientes = [], isLoading, isError, refetch } = useClientes();
  const [busqueda, setBusqueda] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const handleExportarExcel = async () => {
    try {
      setIsExporting(true);
      toast.loading("Generando Excel, por favor espera...", { id: "export-excel" });
      await descargarRespaldoExcel();
      toast.success("Respaldo descargado correctamente", { id: "export-excel" });
    } catch (error: any) {
      toast.error(error.message || "Error al exportar la cartera", { id: "export-excel" });
    } finally {
      setIsExporting(false);
    }
  };

  // Filtrado en tiempo real — nombre, apellidos, cédula o código
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombres.toLowerCase().includes(q) ||
        c.apellidos.toLowerCase().includes(q) ||
        c.cedula.includes(q) ||
        c.codigo_consecutivo.toLowerCase().includes(q),
    );
  }, [clientes, busqueda]);

  const acciones = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => refetch()}
        title="Recargar"
        aria-label="Recargar lista"
        className="h-9 w-9"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button asChild size="sm">
        <Link to="/clientes/nuevo">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo cliente
        </Link>
      </Button>
    </div>
  );

  return (
    <AppShell
      title="Clientes"
      subtitle="Gestión de clientes y rutas de cobranza"
      actions={acciones}
    >
      <div className="space-y-4">
        {/* ── Estadísticas rápidas ── */}
        {!isLoading && !isError && (
          <div className="flex flex-wrap gap-3">
            <StatChip
              label="Total"
              value={clientes.length}
              color="default"
            />
            <StatChip
              label="Activos"
              value={clientes.filter((c) => c.estado === "Activo").length}
              color="emerald"
            />
            <StatChip
              label="Morosos"
              value={clientes.filter((c) => c.estado === "Moroso").length}
              color="red"
            />
            <StatChip
              label="Judiciales"
              value={clientes.filter((c) => c.estado === "Judicial").length}
              color="amber"
            />
          </div>
        )}

        {/* ── Barra de búsqueda ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  Lista de clientes
                </CardTitle>
                <CardDescription>
                  {isLoading
                    ? "Cargando…"
                    : busqueda
                      ? `${clientesFiltrados.length} resultado${clientesFiltrados.length !== 1 ? "s" : ""} de ${clientes.length}`
                      : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} registrado${clientes.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="busqueda-clientes"
                    placeholder="Buscar por nombre, cédula o código…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-8"
                    autoComplete="off"
                  />
                </div>
                <Button 
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center"
                  onClick={handleExportarExcel}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  Exportar Respaldo
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* ── Error ── */}
            {isError && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-destructive font-medium">
                  No se pudieron cargar los clientes.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Reintentar
                </Button>
              </div>
            )}

            {/* ── Tabla ── */}
            {!isError && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Código</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-[120px]">Cédula</TableHead>
                      <TableHead className="w-[130px]">Teléfono</TableHead>
                      <TableHead className="w-[110px]">Barrio</TableHead>
                      <TableHead className="w-[100px]">Estado</TableHead>
                      <TableHead className="w-[52px] text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {/* Skeletons de carga */}
                    {isLoading &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <FilaSkeleton key={i} />
                      ))}

                    {/* Estado vacío */}
                    {!isLoading && clientesFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <EstadoVacio buscando={busqueda.length > 0} />
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Filas de datos */}
                    {!isLoading &&
                      clientesFiltrados.map((cliente) => (
                        <TableRow
                          key={cliente.id}
                          className="group transition-colors hover:bg-muted/40"
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {cliente.codigo_consecutivo}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              {/* Avatar inicial */}
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {cliente.nombres.charAt(0).toUpperCase()}
                                {cliente.apellidos.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium leading-tight">
                                  {cliente.nombres} {cliente.apellidos}
                                </p>
                                {cliente.ruta?.nombre_ruta && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    Ruta: {cliente.ruta.nombre_ruta}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {cliente.cedula}
                          </TableCell>
                          <TableCell className="text-sm">
                            {cliente.telefono_principal}
                          </TableCell>
                          <TableCell className="max-w-[110px]">
                            <span className="truncate text-sm block">
                              {cliente.barrio}
                            </span>
                          </TableCell>
                          <TableCell>
                            <EstadoBadge estado={cliente.estado} />
                          </TableCell>
                          <TableCell className="text-right">
                            <AccionesMenu cliente={cliente} />
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
    </AppShell>
  );
}

// ─── StatChip ─────────────────────────────────────────────────────────────────

type Color = "default" | "emerald" | "red" | "amber";

const COLOR_MAP: Record<Color, string> = {
  default: "bg-muted text-muted-foreground",
  emerald:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-700 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: Color;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${COLOR_MAP[color]}`}
    >
      <Users className="h-3 w-3" />
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
