import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Banknote,
  HandCoins,
  ClipboardCheck,
  Map,
  Package,
  Settings,
  Wallet,
  ShoppingCart,
  Sliders,
  Receipt,
  UserCog,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, type RolNombre } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  /** Si está vacío o ausente, visible para todos los roles autenticados */
  roles?: RolNombre[];
}

// ── Items del menú con control de roles ───────────────────────────────────────

const items: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    roles: ["Administrador", "Gerencia"],
  },
  {
    title: "Nueva Venta",
    url: "/nueva-venta",
    icon: ShoppingCart,
    roles: ["Administrador", "Vendedor", "Cobrador"],
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
    roles: ["Administrador", "Gerencia", "Vendedor", "Auxiliar", "Cobrador"],
  },
  {
    title: "Nuevo Cliente",
    url: "/clientes/nuevo",
    icon: UserPlus,
    roles: ["Administrador", "Vendedor", "Cobrador"],
  },
  {
    title: "Productos",
    url: "/productos",
    icon: Package,
    roles: ["Administrador", "Vendedor", "Cobrador"],
  },
  {
    title: "Créditos",
    url: "/creditos",
    icon: Banknote,
    roles: ["Administrador", "Gerencia", "Auxiliar"],
  },
  {
    title: "Estado de Cuenta",
    url: "/estado-cuenta",
    icon: Receipt,
    roles: ["Administrador", "Gerencia", "Auxiliar", "Cobrador"],
  },
  {
    title: "Cobranza",
    url: "/cobranza",
    icon: HandCoins,
    roles: ["Administrador", "Cobrador"],
  },
  {
    title: "Aprobar Recaudos",
    url: "/cobranza/aprobacion",
    icon: ClipboardCheck,
    roles: ["Administrador", "Gerencia"],
  },
  {
    title: "Rutas",
    url: "/rutas",
    icon: Map,
    roles: ["Administrador", "Gerencia"],
  },
  {
    title: "Migración de Cartera",
    url: "/migracion",
    icon: Wallet,
    roles: ["Administrador"],
  },
  {
    title: "Gestión de Mora",
    url: "/gestion-mora",
    icon: AlertTriangle,
    roles: ["Administrador", "Gerencia"],
  },
  {
    title: "Configuración de Mora",
    url: "/configuracion/mora",
    icon: Sliders,
    roles: ["Administrador"],
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    roles: ["Administrador"],
  },
  {
    title: "Usuarios",
    url: "/usuarios",
    icon: UserCog,
    roles: ["Administrador"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { perfil, signOut } = useAuth();
  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });
  const navigate = useNavigate();

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);

  // Filtrar items según el rol. Si perfil es null (dev sin Supabase), mostrar todo.
  const visibleItems = perfil
    ? items.filter(
        (item) => !item.roles || item.roles.includes(perfil.rol)
      )
    : items;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate({ to: "/login", replace: true });
      toast.success("Sesión cerrada correctamente.");
    } catch {
      toast.error("Error al cerrar la sesión.");
    }
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Header: Logo ──────────────────────────────────────────────── */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white shadow shadow-indigo-600/30">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Mercacrédito</span>
            <span className="truncate text-xs text-muted-foreground">
              ERP de microfinanzas
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Content: Nav items ────────────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: Usuario + Logout ──────────────────────────────────── */}
      <SidebarFooter className="border-t border-border/50">
        <div className="flex items-center gap-2 px-2 py-2">
          {/* Avatar con iniciales */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
            {perfil ? getInitials(perfil.nombre_completo) : "?"}
          </div>

          {/* Nombre y rol */}
          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs font-semibold text-foreground">
              {perfil?.nombre_completo ?? "Sin sesión"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {perfil?.rol ?? "—"}
            </span>
          </div>

          {/* Botón de cerrar sesión */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            onClick={handleSignOut}
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
