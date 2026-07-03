import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Plus,
  UserCheck,
  UserX,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  Users,
  Key,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/context/AuthContext";
import type { RolNombre } from "@/context/AuthContext";
import {
  obtenerUsuarios,
  crearUsuario,
  actualizarEstadoUsuario,
  type UsuarioRow,
} from "@/services/usuarioService";
import { isSupabaseConfigured } from "@/lib/supabase";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [{ title: "Gestión de Usuarios — Mercacrédito" }],
  }),
  component: UsuariosPage,
});

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLES: RolNombre[] = [
  "Administrador",
  "Gerencia",
  "Cobrador",
  "Vendedor",
  "Auxiliar",
];

const WEAK_PASSWORDS = [
  "laadmin",
  "la admin",
  "laadmin1",
  "password",
  "password1",
  "admin123",
  "12345678",
  "qwerty123",
  "mercacredito",
  "123456789",
  "11111111",
  "colombia1",
];

// ── Schema ────────────────────────────────────────────────────────────────────

const crearUsuarioSchema = z
  .object({
    nombre_completo: z
      .string()
      .min(3, "Mínimo 3 caracteres")
      .max(150, "Máximo 150 caracteres"),
    email: z.string().email("Email inválido"),
    rol_nombre: z.enum(
      ["Administrador", "Gerencia", "Cobrador", "Vendedor", "Auxiliar"],
      { required_error: "Selecciona un rol" }
    ),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
      .regex(/[0-9]/, "Debe incluir al menos un número")
      .regex(
        /[^A-Za-z0-9]/,
        "Debe incluir al menos un carácter especial (@, #, $, !…)"
      )
      .refine(
        (val) => !WEAK_PASSWORDS.includes(val.toLowerCase()),
        "Contraseña demasiado predecible. Elige una más segura."
      ),
    confirmar_password: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((d) => d.password === d.confirmar_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar_password"],
  });

type CrearUsuarioForm = z.infer<typeof crearUsuarioSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROL_COLORS: Record<RolNombre, string> = {
  Administrador:
    "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  Gerencia:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Cobrador:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Vendedor:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Auxiliar:
    "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatFecha(ts: string): string {
  return new Date(ts).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

function UsuariosPage() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<UsuarioRow | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Guard: solo Administrador
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (perfil && perfil.rol !== "Administrador") {
      navigate({ to: "/", replace: true });
    }
  }, [perfil, navigate]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: obtenerUsuarios,
    enabled: isSupabaseConfigured,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const crearMutation = useMutation({
    mutationFn: crearUsuario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuario creado correctamente.");
      setDialogOpen(false);
      reset();
    },
    onError: (err: any) => {
      const msg: string = err?.message ?? "Error al crear el usuario";
      if (msg.includes("already registered")) {
        toast.error("Ese email ya está registrado en el sistema.");
      } else {
        toast.error(msg);
      }
    },
  });

  const toggleEstadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: "Activo" | "Inactivo" }) =>
      actualizarEstadoUsuario(id, estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Estado del usuario actualizado.");
      setToggleTarget(null);
    },
    onError: () => toast.error("Error al cambiar el estado."),
  });

  // ── Form ──────────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CrearUsuarioForm>({ resolver: zodResolver(crearUsuarioSchema) });

  const onSubmit = (data: CrearUsuarioForm) => {
    crearMutation.mutate({
      nombre_completo: data.nombre_completo,
      email: data.email,
      password: data.password,
      rol_nombre: data.rol_nombre,
    });
  };

  const rolValue = watch("rol_nombre");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell
      title="Gestión de Usuarios"
      subtitle="Crea y administra las cuentas del equipo"
      actions={
        <Button
          id="btn-nuevo-usuario"
          size="sm"
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-600/20"
          onClick={() => {
            reset();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Key className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <strong>Requisito:</strong> Para que los empleados inicien sesión de
            inmediato, asegúrate de deshabilitar "Confirm email" en{" "}
            <em>Supabase → Settings → Auth → Email</em>. De lo contrario, recibirán
            un email de confirmación.
          </p>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Usuario
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Rol
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider hidden md:table-cell">
                  Registrado
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Estado
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-2.5 w-40" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Users className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No hay usuarios registrados aún.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDialogOpen(true)}
                      >
                        Crear el primer usuario
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((u) => (
                  <TableRow
                    key={u.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar + nombre + email */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                          {getInitials(u.nombre_completo)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {u.nombre_completo}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Rol */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${ROL_COLORS[u.rol] ?? ""}`}
                      >
                        {u.rol}
                      </Badge>
                    </TableCell>

                    {/* Fecha */}
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {formatFecha(u.fecha_creacion)}
                    </TableCell>

                    {/* Estado */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.estado === "Activo"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs"
                        }
                      >
                        {u.estado}
                      </Badge>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setToggleTarget(u)}
                      >
                        {u.estado === "Activo" ? (
                          <>
                            <UserX className="h-3.5 w-3.5 text-rose-500" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                            Activar
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Dialog: Crear usuario ─────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              Nuevo Empleado / Usuario
            </DialogTitle>
            <DialogDescription className="text-xs">
              Completa los datos para crear la cuenta. El empleado podrá iniciar
              sesión de inmediato con estas credenciales.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Nombre completo */}
            <div className="space-y-1.5">
              <Label htmlFor="nombre_completo" className="text-xs font-medium">
                Nombre completo
              </Label>
              <Input
                id="nombre_completo"
                placeholder="Ej. María Rodríguez López"
                {...register("nombre_completo")}
              />
              {errors.nombre_completo && (
                <p className="text-xs text-rose-500">
                  {errors.nombre_completo.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email-usuario" className="text-xs font-medium">
                Correo electrónico
              </Label>
              <Input
                id="email-usuario"
                type="email"
                placeholder="empleado@mercacredito.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-rose-500">{errors.email.message}</p>
              )}
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rol</Label>
              <Select
                value={rolValue}
                onValueChange={(val) =>
                  setValue("rol_nombre", val as RolNombre, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="rol-select">
                  <SelectValue placeholder="Selecciona un rol..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.rol_nombre && (
                <p className="text-xs text-rose-500">
                  {errors.rol_nombre.message}
                </p>
              )}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="password-nuevo" className="text-xs font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password-nuevo"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número, 1 especial"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmar-password" className="text-xs font-medium">
                Confirmar contraseña
              </Label>
              <div className="relative">
                <Input
                  id="confirmar-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repite la contraseña"
                  className="pr-10"
                  {...register("confirmar_password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmar_password && (
                <p className="text-xs text-rose-500">
                  {errors.confirmar_password.message}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogOpen(false);
                  reset();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || crearMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {crearMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Creando…
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Confirmar cambio de estado ───────────────────────── */}
      <AlertDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.estado === "Activo"
                ? "¿Desactivar este usuario?"
                : "¿Activar este usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.estado === "Activo"
                ? `${toggleTarget?.nombre_completo} no podrá iniciar sesión mientras su cuenta esté inactiva.`
                : `${toggleTarget?.nombre_completo} podrá volver a iniciar sesión en el sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toggleTarget &&
                toggleEstadoMutation.mutate({
                  id: toggleTarget.id,
                  estado:
                    toggleTarget.estado === "Activo" ? "Inactivo" : "Activo",
                })
              }
              className={
                toggleTarget?.estado === "Activo"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }
            >
              {toggleTarget?.estado === "Activo" ? "Desactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
