import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  Wallet,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar Sesión — Mercacrédito" },
      {
        name: "description",
        content: "Accede al ERP de gestión de microcréditos Mercacrédito.",
      },
    ],
  }),
  component: LoginPage,
});

// ── Schema ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

// ── Decorative data ───────────────────────────────────────────────────────────

const features = [
  { icon: TrendingUp, label: "Cartera activa", desc: "Control total de créditos" },
  { icon: Users, label: "Rutas de cobranza", desc: "Gestión de cobros en campo" },
  { icon: ShieldCheck, label: "Seguridad RBAC", desc: "Acceso por roles y permisos" },
];

// ── Component ─────────────────────────────────────────────────────────────────

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      await signIn(data.email, data.password);
      // RouteGuard en __root.tsx detecta el cambio de sesión y redirige automáticamente
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (
        msg.includes("Invalid login credentials") ||
        msg.includes("invalid_credentials")
      ) {
        toast.error("Email o contraseña incorrectos.");
      } else if (msg.includes("Email not confirmed")) {
        toast.error(
          "El email aún no ha sido confirmado. Revisa tu bandeja de entrada."
        );
      } else if (msg.includes("Too many requests")) {
        toast.error("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
      } else {
        toast.error(msg || "Error al iniciar sesión. Inténtalo de nuevo.");
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* ── Panel izquierdo: Branding (solo en pantallas grandes) ── */}
      <aside className="hidden lg:flex lg:w-[44%] flex-col justify-between bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-14 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-violet-600/8 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-3xl" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl overflow-hidden shadow-lg shadow-indigo-600/20 bg-white border border-white/10">
            <img src="/pwa-192x192.png" alt="Logo Mercacrédito" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-tight">Mercacrédito</p>
            <p className="text-xs text-indigo-300/70 font-medium">ERP de Microfinanzas</p>
          </div>
        </div>

        {/* Tagline central */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-[2.6rem] font-extrabold text-white leading-[1.15] tracking-tight">
              Gestiona tu cartera<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                con inteligencia
              </span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-[22rem]">
              Plataforma integral para microfinancieras: créditos, cobros en campo,
              rutas y reportes en tiempo real.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-center gap-3.5 rounded-2xl border border-white/6 bg-white/4 px-4 py-3.5 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20">
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-700 relative z-10">
          © {new Date().getFullYear()} Mercacrédito · Sistema de uso interno
        </p>
      </aside>

      {/* ── Panel derecho: Formulario ── */}
      <main className="flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-[360px] space-y-9">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-lg bg-white border border-white/10">
              <img src="/pwa-192x192.png" alt="Logo Mercacrédito" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Mercacrédito</p>
              <p className="text-xs text-slate-500">ERP de Microfinanzas</p>
            </div>
          </div>

          {/* Encabezado */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-white">Bienvenido de vuelta</h2>
            <p className="text-sm text-slate-500">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@mercacredito.com"
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-700 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-slate-300 text-sm font-medium"
              >
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-700 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 pr-11"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-400">{errors.password.message}</p>
              )}
            </div>

            {/* Botón */}
            <Button
              type="submit"
              id="btn-login"
              disabled={isSubmitting}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/25 transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando…
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-700 leading-relaxed">
            Acceso exclusivo para personal autorizado.
            <br />
            Contacta al administrador si olvidaste tu contraseña.
          </p>
        </div>
      </main>
    </div>
  );
}
