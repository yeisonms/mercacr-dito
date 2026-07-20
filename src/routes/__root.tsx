import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2, Wallet } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineFallback } from "@/components/pwa/OfflineFallback";
import { registerSW } from "virtual:pwa-register";

// ── Not found ─────────────────────────────────────────────────────────────────

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Página no encontrada
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o ha sido movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────────

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal. Puedes intentar refrescar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
          <Wallet className="h-7 w-7 text-white" />
        </div>
        <div className="flex items-center gap-2.5 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Verificando sesión…</span>
        </div>
      </div>
    </div>
  );
}

// ── Route Guard ───────────────────────────────────────────────────────────────
/**
 * Protege las rutas verificando la sesión activa y el rol del usuario.
 *
 * Reglas:
 * - Sin sesión → redirige a /login
 * - Con sesión en /login → redirige al home del rol
 * - Cobrador fuera de /cobranza → redirige a /cobranza
 * - Sin Supabase configurado → no aplica protección (modo desarrollo)
 */
function RouteGuard({ children }: { children: ReactNode }) {
  const { session, perfil, cargando } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (cargando) return;
    if (!isSupabaseConfigured) return; // Sin Supabase → desarrollo libre

    const isLoginPage = pathname === "/login";

    // Sin sesión fuera del login → login
    if (!session && !isLoginPage) {
      navigate({ to: "/login", replace: true });
      return;
    }

    // Con sesión en login → redirigir al home del rol
    if (session && perfil && isLoginPage) {
      navigate({
        to: perfil.rol === "Cobrador" ? "/cobranza" : "/",
        replace: true,
      });
      return;
    }

    // Cobrador intentando acceder a rutas no permitidas
    if (
      session &&
      perfil?.rol === "Cobrador" &&
      !isLoginPage
    ) {
      const allowedPaths = [
        "/cobranza",
        "/creditos",
        "/clientes",
        "/productos",
        "/estado-cuenta",
        "/nueva-venta"
      ];
      
      const isAllowed = allowedPaths.some(path => pathname.startsWith(path)) || pathname === "/";
      
      if (!isAllowed) {
        navigate({ to: "/cobranza", replace: true });
      }
    }
  }, [cargando, session, perfil, pathname, navigate]);

  // Pantalla de carga durante la resolución inicial de sesión
  if (cargando) return <LoadingScreen />;

  // Evitar el flash de contenido protegido mientras se redirige
  if (isSupabaseConfigured && !session && pathname !== "/login") return null;
  if (isSupabaseConfigured && session && perfil && pathname === "/login") return null;

  return <>{children}</>;
}

// ── Root route ────────────────────────────────────────────────────────────────

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Mercacrédito ERP" },
        {
          name: "description",
          content: "ERP de gestión de microcréditos y cobranza para Mercacrédito.",
        },
        { name: "author", content: "Mercacrédito" },
        { name: "theme-color", content: "#0f766e" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "icon", href: "/favicon.ico" }
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  }
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Registra el Service Worker de la PWA
    if ("serviceWorker" in navigator) {
      registerSW({ immediate: true });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouteGuard>
          <Outlet />
        </RouteGuard>
      </AuthProvider>
      <Toaster richColors position="top-right" />
      <InstallPrompt />
      <OfflineFallback />
    </QueryClientProvider>
  );
}
