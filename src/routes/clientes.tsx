import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Mercacrédito" }] }),
  component: () => (
    <AppShell title="Clientes" subtitle="Gestión de clientes y rutas">
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Módulo de Clientes — próximamente.
        </CardContent>
      </Card>
    </AppShell>
  ),
});
