import type { ReactNode } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const ROL_BADGE_CLASS: Record<string, string> = {
  Administrador: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  Gerencia: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Cobrador: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Vendedor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Auxiliar: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
};

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { perfil } = useAuth();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-5" />

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            {/* Título y subtítulo */}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {/* Derecha: badge de rol + acciones */}
            <div className="flex items-center gap-3 shrink-0">
              {perfil && (
                <Badge
                  variant="outline"
                  className={`hidden sm:flex text-xs ${ROL_BADGE_CLASS[perfil.rol] ?? ""}`}
                >
                  {perfil.rol}
                </Badge>
              )}
              {actions ? <div>{actions}</div> : null}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
