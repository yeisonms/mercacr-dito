import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/cobranza")({
  head: () => ({ meta: [{ title: "Cobranza — Mercacrédito" }] }),
  component: () => (
    <AppShell title="Cobranza" subtitle="Recaudos diarios por cobrador">
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Módulo de Cobranza — próximamente.
        </CardContent>
      </Card>
    </AppShell>
  ),
});
