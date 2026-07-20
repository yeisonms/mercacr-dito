import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet,
  HandCoins,
  Database,
  TrendingUp,
  PiggyBank,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RecaudosChart } from "@/components/dashboard/RecaudosChart";
import { CarteraDonutChart } from "@/components/dashboard/CarteraDonutChart";
import { TopCobradoresTable } from "@/components/dashboard/TopCobradoresTable";
import { ClientesCriticosTable } from "@/components/dashboard/ClientesCriticosTable";
import {
  useDashboardKpis,
  useRecaudosSemana,
  useEstadoCartera,
  useTopCobradores,
  useClientesCriticos,
} from "@/hooks/use-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatearMoneda } from "@/services/producto.service";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mercacrédito" },
      {
        name: "description",
        content:
          "Panel principal de administración: recaudos del día, cartera activa, ventas del mes y utilidad.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { perfil } = useAuth();
  const isAuxiliar = perfil?.rol === "Auxiliar";
  
  const { data: kpis, isLoading: loadingKpis } = useDashboardKpis();
  const { data: recaudos } = useRecaudosSemana();
  const { data: estadoCartera, isLoading: loadingCartera } = useEstadoCartera();
  const { data: topCobradores, isLoading: loadingCobradores } = useTopCobradores();
  const { data: clientesCriticos, isLoading: loadingCriticos } = useClientesCriticos();

  return (
    <AppShell
      title="Dashboard"
      subtitle="Panel de administración y control operativo"
    >
      <div className="space-y-6">
        {!isSupabaseConfigured ? (
          <Alert variant="destructive">
            <Database className="h-4 w-4" />
            <AlertTitle>Conecta tu base de datos Supabase</AlertTitle>
            <AlertDescription>
              Crea un archivo <code className="font-mono">.env</code> en la raíz
              del proyecto (puedes copiar <code>.env.example</code>) con tus
              credenciales:
              <pre className="mt-2 rounded-md bg-muted p-3 text-xs text-foreground">
                {`VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica`}
              </pre>
              Reinicia el servidor de desarrollo después de guardar el archivo.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ── Tarjetas de Indicadores Clave (KPIs) ── */}
        <div className={cn("grid gap-4 sm:grid-cols-2", isAuxiliar ? "xl:grid-cols-1" : "xl:grid-cols-4")}>
          <KpiCard
            label="Recaudos del día"
            value={formatearMoneda(kpis?.recaudosDelDia ?? 0)}
            icon={HandCoins}
            hint="Cobros aprobados hoy"
            loading={loadingKpis}
            tone="success"
          />
          {!isAuxiliar && (
            <>
              <KpiCard
                label="Cartera activa"
                value={formatearMoneda(kpis?.carteraActiva ?? 0)}
                icon={Wallet}
                hint="Saldo por cobrar vigente"
                loading={loadingKpis}
                tone="default"
              />
              <KpiCard
                label="Ventas del mes"
                value={formatearMoneda(kpis?.ventasDelMes ?? 0)}
                icon={TrendingUp}
                hint="Total facturado este mes"
                loading={loadingKpis}
                tone="warning"
              />
              <KpiCard
                label="Utilidad del mes"
                value={formatearMoneda(kpis?.utilidadDelMes ?? 0)}
                icon={PiggyBank}
                hint="Recaudos + Contados - Gastos"
                loading={loadingKpis}
                tone={kpis && kpis.utilidadDelMes >= 0 ? "success" : "danger"}
              />
            </>
          )}
        </div>

        {/* ── Sección de Gráficos (Tendencia y Estado de Cartera) ── */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className={isAuxiliar ? "lg:col-span-5" : "lg:col-span-3"}>
            <RecaudosChart data={recaudos ?? []} />
          </div>
          {!isAuxiliar && (
            <div className="lg:col-span-2">
              <CarteraDonutChart data={estadoCartera ?? []} loading={loadingCartera} />
            </div>
          )}
        </div>

        {/* ── Mini-Tablas de Monitoreo Rápido ── */}
        <div className={cn("grid gap-6", isAuxiliar ? "md:grid-cols-1" : "md:grid-cols-2")}>
          {!isAuxiliar && (
            <TopCobradoresTable data={topCobradores ?? []} loading={loadingCobradores} />
          )}
          <ClientesCriticosTable data={clientesCriticos ?? []} loading={loadingCriticos} />
        </div>
      </div>
    </AppShell>
  );
}
