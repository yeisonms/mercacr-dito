import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/creditos")({
  head: () => ({ meta: [{ title: "Créditos — Mercacrédito" }] }),
  component: () => (
    <AppShell title="Créditos" subtitle="Originación y seguimiento de créditos">
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Módulo de Créditos — próximamente.
        </CardContent>
      </Card>
    </AppShell>
  ),
});
