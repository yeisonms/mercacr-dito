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
import { Progress } from "@/components/ui/progress";
import type { TopCobrador } from "@/services/dashboard.service";
import { formatearMoneda } from "@/services/producto.service";
import { Trophy, Award } from "lucide-react";

interface Props {
  data: TopCobrador[];
  loading?: boolean;
}

export function TopCobradoresTable({ data, loading }: Props) {
  // Encontrar el valor máximo recaudado para calcular porcentaje relativo
  const maxRecaudado = data.length > 0 ? Math.max(...data.map((c) => c.totalRecaudado)) : 0;

  return (
    <Card className="flex flex-col h-full border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4.5 w-4.5 text-amber-500 shrink-0" />
          <CardTitle className="text-base font-semibold">Top Cobradores del Mes</CardTitle>
        </div>
        <CardDescription>Líderes de recaudación (recaudos aprobados del mes)</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-4 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            Aún no se registran recaudos aprobados este mes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-10 text-center">Pos</TableHead>
                  <TableHead>Cobrador</TableHead>
                  <TableHead className="text-right">Monto Recaudado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((cobrador, index) => {
                  const pct = maxRecaudado > 0 ? (cobrador.totalRecaudado / maxRecaudado) * 100 : 0;
                  return (
                    <TableRow key={cobrador.nombre} className="hover:bg-muted/5">
                      <TableCell className="text-center font-bold text-xs text-muted-foreground">
                        {index === 0 ? (
                          <span className="text-amber-500">1º</span>
                        ) : index === 1 ? (
                          <span className="text-slate-400">2º</span>
                        ) : (
                          <span>{index + 1}º</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-xs text-foreground">
                            {cobrador.nombre}
                          </span>
                          <Progress
                            value={pct}
                            className="h-1 bg-primary/10"
                            style={
                              {
                                "--progress-indicator-color":
                                  index === 0
                                    ? "var(--color-warning)"
                                    : "var(--color-primary)",
                              } as any
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2.5 font-bold text-xs text-primary whitespace-nowrap">
                        {formatearMoneda(cobrador.totalRecaudado)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
