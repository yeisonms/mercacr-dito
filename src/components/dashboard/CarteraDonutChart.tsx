import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EstadoCarteraData } from "@/services/dashboard.service";
import { formatearMoneda } from "@/services/producto.service";

interface Props {
  data: EstadoCarteraData[];
  loading?: boolean;
}

// Colores semánticos para los estados de la cartera
const COLORS: Record<string, string> = {
  "Al día": "#10b981",          // Emerald-500
  "Próximo a vencer": "#f59e0b", // Amber-500
  "Atrasado": "#f97316",         // Orange-500
  "En mora": "#f43f5e",          // Rose-500
};

export function CarteraDonutChart({ data, loading }: Props) {
  const totalCartera = data.reduce((sum, item) => sum + item.value, 0);

  const formatPercent = (value: number) => {
    if (totalCartera === 0) return "0.0%";
    return `${((value / totalCartera) * 100).toFixed(1)}%`;
  };

  return (
    <Card className="flex flex-col h-full border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Estado de Cartera</CardTitle>
        <CardDescription>Distribución del saldo pendiente por estados</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center min-h-[280px]">
        {loading ? (
          <div className="space-y-4 w-full">
            <Skeleton className="mx-auto h-40 w-40 rounded-full" />
            <div className="flex justify-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ) : totalCartera === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No hay cartera activa registrada.
          </div>
        ) : (
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6">
            {/* Contenedor del gráfico */}
            <div className="h-48 w-48 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[entry.name] || "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [
                      `${formatearMoneda(Number(value))} (${formatPercent(Number(value))})`,
                      "Saldo",
                    ]}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-popover-foreground)",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Texto central dentro de la dona */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="text-base font-bold text-foreground">
                  {formatearMoneda(totalCartera)}
                </span>
              </div>
            </div>

            {/* Leyenda personalizada lateral */}
            <div className="flex-1 space-y-2.5 w-full">
              {data.map((entry) => {
                const color = COLORS[entry.name] || "#6b7280";
                return (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between text-xs border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-foreground">{entry.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-foreground block">
                        {formatearMoneda(entry.value)}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {formatPercent(entry.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
