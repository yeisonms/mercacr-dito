import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle, DollarSign, Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { corregirRecaudo } from "@/services/recaudoService";
import { useAuth } from "@/context/AuthContext";

interface ModalCorregirRecaudoProps {
  isOpen: boolean;
  onClose: () => void;
  recaudo: {
    id: string;
    fecha: string;
    valorRecibido: number;
    cobrador: string;
    observaciones: string | null;
  } | null;
  credito: {
    id: string;
    numeroFactura: string;
    saldoPendiente: number;
    saldoContado: number | null;
    tipoVenta: string;
  } | null;
  clienteNombre: string;
  onSuccess: (resultado: {
    recaudoId: string;
    nuevoValor: number;
    nuevoSaldoPendiente: number;
    nuevoSaldoContado: number | null;
  }) => void;
}

export function ModalCorregirRecaudo({
  isOpen,
  onClose,
  recaudo,
  credito,
  clienteNombre,
  onSuccess,
}: ModalCorregirRecaudoProps) {
  const { perfil } = useAuth();
  const [nuevoValorStr, setNuevoValorStr] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && recaudo) {
      setNuevoValorStr(String(recaudo.valorRecibido));
      setMotivo("");
      setIsSubmitting(false);
    }
  }, [isOpen, recaudo]);

  if (!recaudo || !credito) return null;

  const valorActual = Number(recaudo.valorRecibido) || 0;
  const nuevoValorNum = Number(nuevoValorStr) || 0;
  const delta = nuevoValorNum - valorActual; // si baja a 20.000 desde 200.000: delta = -180.000

  // Saldo proyectado
  const saldoPendienteActual = Number(credito.saldoPendiente) || 0;
  const nuevoSaldoPendienteProyectado = Math.max(0, saldoPendienteActual - delta);

  let nuevoSaldoContadoProyectado: number | null = null;
  if (credito.saldoContado != null) {
    const saldoContadoActual = Number(credito.saldoContado) || 0;
    nuevoSaldoContadoProyectado = Math.max(0, saldoContadoActual - delta);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nuevoValorNum <= 0) {
      toast.error("El nuevo valor del recaudo debe ser mayor a 0");
      return;
    }

    if (nuevoValorNum === valorActual) {
      toast.info("El nuevo valor es idéntico al actual. No hay cambios.");
      return;
    }

    if (!motivo.trim() || motivo.trim().length < 5) {
      toast.error("Debes ingresar un motivo detallado (mínimo 5 caracteres)");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await corregirRecaudo({
        recaudoId: recaudo.id,
        nuevoValor: nuevoValorNum,
        motivo: motivo.trim(),
        usuarioId: perfil?.id,
        usuarioNombre: perfil?.nombre_completo || "Administrador",
      });

      toast.success("Recaudo corregido y saldos recalculados con éxito");
      onSuccess({
        recaudoId: recaudo.id,
        nuevoValor: nuevoValorNum,
        nuevoSaldoPendiente: res.nuevoSaldoPendiente,
        nuevoSaldoContado: res.nuevoSaldoContado,
      });
      onClose();
    } catch (err: any) {
      console.error("Error al corregir recaudo:", err);
      toast.error(err.message || "Error al corregir el recaudo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md p-5 bg-background">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Corregir Valor del Recaudo
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajusta el valor real recibido para el cliente <strong>{clienteNombre}</strong>.
            Esta acción recalculará automáticamente la tabla de amortización y las comisiones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Ficha Resumen */}
          <div className="bg-muted/50 border rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Factura:</span>
              <span className="font-semibold font-mono">{credito.numeroFactura}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cobrador original:</span>
              <span className="font-medium">{recaudo.cobrador}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Actual Registrado:</span>
              <span className="font-bold text-foreground">
                ${valorActual.toLocaleString("es-CO")}
              </span>
            </div>
          </div>

          {/* Campo Nuevo Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="nuevoValor" className="text-xs font-semibold">
              Nuevo Valor Recibido ($)
            </Label>
            <Input
              id="nuevoValor"
              type="number"
              min="1"
              step="any"
              value={nuevoValorStr}
              onChange={(e) => setNuevoValorStr(e.target.value)}
              placeholder="Ej. 20000"
              className="h-10 text-base font-bold text-emerald-600"
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {/* Previsualización del Impacto */}
          {nuevoValorNum > 0 && nuevoValorNum !== valorActual && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Impacto del Ajuste Financiero</span>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Diferencia en Caja:</span>
                  <span
                    className={`font-bold ${
                      delta > 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}${delta.toLocaleString("es-CO")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Saldo Pendiente Crédito:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    ${saldoPendienteActual.toLocaleString("es-CO")}
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-bold text-primary">
                      ${nuevoSaldoPendienteProyectado.toLocaleString("es-CO")}
                    </span>
                  </span>
                </div>
                {nuevoSaldoContadoProyectado != null && (
                  <div className="flex justify-between items-center">
                    <span>Saldo Credicontado:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      ${Number(credito.saldoContado).toLocaleString("es-CO")}
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold text-emerald-600">
                        ${nuevoSaldoContadoProyectado.toLocaleString("es-CO")}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Motivo Obligatorio */}
          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-xs font-semibold">
              Motivo de la Corrección (Obligatorio)
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Cobrador digitó un cero adicional en ruta; el cliente abonó $20.000 en efectivo."
              rows={3}
              className="text-xs resize-none"
              required
              disabled={isSubmitting}
            />
            <p className="text-3xs text-muted-foreground">
              Quedará registrado en la auditoría del sistema con tu usuario.
            </p>
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-9 text-xs font-semibold gap-1.5"
              disabled={isSubmitting || nuevoValorNum <= 0 || nuevoValorNum === valorActual}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar y Recalcular
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

