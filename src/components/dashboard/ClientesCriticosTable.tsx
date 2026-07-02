import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { ClienteCritico } from "@/services/dashboard.service";
import { formatearMoneda } from "@/services/producto.service";
import { AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  data: ClienteCritico[];
  loading?: boolean;
}

export function ClientesCriticosTable({ data, loading }: Props) {
  return (
    <Card className="flex flex-col h-full border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5 text-destructive shrink-0" />
          <CardTitle className="text-base font-semibold">Alerta de Clientes Críticos</CardTitle>
        </div>
        <CardDescription>Clientes con mayor tiempo de atraso en cuotas</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            🎉 No hay clientes críticos o en mora registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Atraso</TableHead>
                  <TableHead className="text-right">Saldo Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((cliente) => (
                  <TableRow key={cliente.id} className="hover:bg-destructive/[0.02]">
                    <TableCell className="py-2.5 font-semibold text-xs text-foreground">
                      {/* Enlace al perfil del cliente */}
                      <Link
                        to="/clientes/$clienteId"
                        params={{ clienteId: cliente.id }}
                        className="hover:underline hover:text-primary transition-all"
                      >
                        {cliente.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center py-2.5">
                      <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/20 text-3xs font-bold px-2 py-0.5">
                        {cliente.diasAtraso} días
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2.5 font-bold text-xs text-foreground whitespace-nowrap">
                      {formatearMoneda(cliente.saldoPendiente)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
