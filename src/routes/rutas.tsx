import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/rutas")({
  head: () => ({ meta: [{ title: "Rutas — Mercacrédito" }] }),
  component: () => (
    <AppShell title="Rutas" subtitle="Organización de rutas de cobranza">
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Módulo de Rutas — próximamente.
        </CardContent>
      </Card>
    </AppShell>
  ),
});
