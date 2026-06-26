import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet,
  HandCoins,
  Users,
  AlertTriangle,
  Database,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RecaudosChart } from "@/components/dashboard/RecaudosChart";
import {
  useDashboardKpis,
  useRecaudosSemana,
} from "@/hooks/use-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mercacrédito" },
      {
        name: "description",
        content:
          "Panel principal del ERP Mercacrédito: cartera activa, recaudos del día, clientes activos y en mora.",
      },
    ],
  }),
  component: DashboardPage,
});

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function DashboardPage() {
  const { data: kpis, isLoading: loadingKpis } = useDashboardKpis();
  const { data: recaudos } = useRecaudosSemana();

  return (
    <AppShell
      title="Dashboard"
      subtitle="Resumen operativo de Mercacrédito"
    >
      <div className="space-y-6">
        {!isSupabaseConfigured ? (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>Conecta tu base de datos Supabase</AlertTitle>
            <AlertDescription>
              Crea un archivo <code className="font-mono">.env</code> en la raíz
              del proyecto (puedes copiar <code>.env.example</code>) con tus
              credenciales:
              <pre className="mt-2 rounded-md bg-muted p-3 text-xs">
                {`VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica`}
              </pre>
              Reinicia el servidor de desarrollo después de guardar el archivo.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Cartera activa"
            value={formatoCOP.format(kpis?.carteraActiva ?? 0)}
            icon={Wallet}
            hint="Saldo pendiente total"
            loading={loadingKpis}
          />
          <KpiCard
            label="Recaudos del día"
            value={formatoCOP.format(kpis?.recaudosDelDia ?? 0)}
            icon={HandCoins}
            hint="Cobros realizados hoy"
            loading={loadingKpis}
            tone="success"
          />
          <KpiCard
            label="Clientes activos"
            value={String(kpis?.clientesActivos ?? 0)}
            icon={Users}
            hint="Con crédito vigente"
            loading={loadingKpis}
          />
          <KpiCard
            label="Clientes en mora"
            value={String(kpis?.clientesEnMora ?? 0)}
            icon={AlertTriangle}
            hint="Requieren gestión"
            loading={loadingKpis}
            tone="danger"
          />
        </div>

        <RecaudosChart data={recaudos ?? []} />
      </div>
    </AppShell>
  );
}
