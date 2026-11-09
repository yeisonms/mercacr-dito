import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, Ban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { anularRecaudo } from "@/services/recaudoService";
import { useAuth } from "@/context/AuthContext";

interface ModalAnularRecaudoProps {
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
  } | null;
  clienteNombre: string;
  onSuccess: (resultado: {
    recaudoId: string;
    nuevoSaldoPendiente: number;
    nuevoSaldoContado: number | null;
  }) => void;
}

export function ModalAnularRecaudo({
  isOpen,
  onClose,
  recaudo,
  credito,
  clienteNombre,
  onSuccess,
}: ModalAnularRecaudoProps) {
  const { perfil } = useAuth();
  const [motivo, setMotivo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!recaudo || !credito) return null;

  const valorRecibido = Number(recaudo.valorRecibido) || 0;
  const saldoActual = Number(credito.saldoPendiente) || 0;
  const nuevoSaldoProyectado = saldoActual + valorRecibido;

  const handleAnular = async () => {
    if (!motivo.trim() || motivo.trim().length < 5) {
      toast.error("Debes ingresar un motivo detallado de la anulación (mínimo 5 caracteres)");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await anularRecaudo({
        recaudoId: recaudo.id,
        motivo: motivo.trim(),
        usuarioId: perfil?.id,
        usuarioNombre: perfil?.nombre_completo || "Administrador",
      });

      toast.success("Recaudo anulado exitosamente y saldo revertido");
      onSuccess({
        recaudoId: recaudo.id,
        nuevoSaldoPendiente: res.nuevoSaldoPendiente,
        nuevoSaldoContado: res.nuevoSaldoContado,
      });
      onClose();
    } catch (err: any) {
      console.error("Error al anular recaudo:", err);
      toast.error(err.message || "Error al anular el recaudo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md p-5 bg-background">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
            <Ban className="w-5 h-5 text-destructive" />
            Anular Recaudo / Pago
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ¿Estás seguro de anular este pago de <strong>${valorRecibido.toLocaleString("es-CO")}</strong> para <strong>{clienteNombre}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Alerta de Impacto */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Consecuencias de la Anulación</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-3xs sm:text-xs">
              <li>
                El estado del recaudo pasará a <strong>Rechazado / Anulado</strong>.
              </li>
              <li>
                El saldo del crédito aumentará de{" "}
                <strong>${saldoActual.toLocaleString("es-CO")}</strong> a{" "}
                <strong className="text-foreground">
                  ${nuevoSaldoProyectado.toLocaleString("es-CO")}
                </strong>.
              </li>
              <li>
                Las cuotas cubiertas por este pago volverán a quedar pendientes.
              </li>
              <li>
                Se descontará este valor del reporte de comisiones del cobrador.
              </li>
            </ul>
          </div>

          {/* Motivo Obligatorio */}
          <div className="space-y-1.5">
            <Label htmlFor="motivoAnulacion" className="text-xs font-semibold">
              Motivo de la Anulación (Obligatorio)
            </Label>
            <Textarea
              id="motivoAnulacion"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Pago duplicado por error / Cobro registrado al cliente equivocado."
              rows={3}
              className="text-xs resize-none"
              required
              disabled={isSubmitting}
            />
            <p className="text-3xs text-muted-foreground">
              Esta acción es irreversible y quedará registrada en los logs de auditoría.
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
              type="button"
              variant="destructive"
              className="h-9 text-xs font-semibold gap-1.5"
              onClick={handleAnular}
              disabled={isSubmitting || motivo.trim().length < 5}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmar Anulación
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

