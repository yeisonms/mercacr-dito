import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuración — Mercacrédito" }] }),
  component: () => (
    <AppShell title="Configuración" subtitle="Usuarios, roles y parámetros">
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Módulo de Configuración — próximamente.
        </CardContent>
      </Card>
    </AppShell>
  ),
});
