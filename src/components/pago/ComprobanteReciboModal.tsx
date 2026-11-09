import { useRef } from "react";
import { toPng, toBlob } from "html-to-image";
import { toast } from "sonner";
import { CheckCircle2, Download, Share2, MessageCircle, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ReciboData {
  fecha: string;
  clienteNombre: string;
  abono: number;
  totalCredito: number;
  saldoPendiente: number;
  telefono: string;
  tipoCredito?: string;
  totalCredicontado?: number | null;
  saldoCredicontado?: number | null;
  penalidadAplicada?: boolean;
  fechaLimitePago?: string | null;
  numeroFactura?: string;
  cobradorNombre?: string;
  esCorregido?: boolean;
}

interface ComprobanteReciboModalProps {
  isOpen: boolean;
  onClose: () => void;
  reciboData: ReciboData | null;
}

export function ComprobanteReciboModal({
  isOpen,
  onClose,
  reciboData,
}: ComprobanteReciboModalProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!reciboData) return null;

  const descargarRecibo = async () => {
    if (!ticketRef.current) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      const cleanName = reciboData.clienteNombre.replace(/\s+/g, "_");
      link.download = `Recibo_Mercacredito_${cleanName}.png`;
      link.click();
      toast.success("Recibo descargado correctamente");
    } catch (err) {
      console.error("Error al descargar recibo:", err);
      toast.error("Error al descargar el recibo");
    }
  };

  const compartirRecibo = async () => {
    if (!ticketRef.current) return;
    try {
      const blob = await toBlob(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      if (!blob) throw new Error("No se pudo generar");
      const cleanName = reciboData.clienteNombre.replace(/\s+/g, "_");
      const file = new File([blob], `Recibo_Mercacredito_${cleanName}.png`, {
        type: blob.type,
      });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        toast.info(
          "Compartir imágenes no está soportado en este dispositivo. Utiliza la opción de descargar."
        );
      }
    } catch (err) {
      console.error("Error al compartir recibo:", err);
      toast.error("Error al intentar compartir el recibo");
    }
  };

  const enviarWhatsApp = () => {
    const {
      clienteNombre,
      abono,
      saldoPendiente,
      saldoCredicontado,
      penalidadAplicada,
      fechaLimitePago,
      telefono,
      numeroFactura,
      esCorregido,
    } = reciboData;

    let tel = (telefono || "").replace(/\D/g, "");
    if (!tel.startsWith("57") && tel.length === 10) tel = "57" + tel;

    let mensaje = `*MERCACRÉDITO - COMPROBANTE DE PAGO*\n`;
    if (esCorregido) {
      mensaje += `_(Comprobante Corregido / Actualizado)_\n`;
    }
    mensaje += `\nHola *${clienteNombre}*, confirmamos el detalle de tu pago.\n\n`;
    if (numeroFactura) {
      mensaje += `📄 *Factura:* ${numeroFactura}\n`;
    }
    mensaje += `✅ *Abono Realizado:* $${Number(abono || 0).toLocaleString("es-CO")}\n`;
    mensaje += `⚠️ *Saldo Crédito:* $${Number(saldoPendiente || 0).toLocaleString("es-CO")}\n`;

    if (
      saldoCredicontado !== undefined &&
      saldoCredicontado !== null &&
      !penalidadAplicada
    ) {
      mensaje += `⚠️ *Saldo Credicontado:* $${Number(saldoCredicontado).toLocaleString("es-CO")}\n`;
    }

    if (fechaLimitePago) {
      try {
        const fechaLimite = new Date(fechaLimitePago + "T00:00:00").toLocaleDateString(
          "es-CO",
          {
            timeZone: "America/Bogota",
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        );
        mensaje += `⏰ *Límite Beneficio:* ${fechaLimite}\n`;
      } catch {
        // Ignorar error de formateo de fecha
      }
    }

    mensaje += `\n_¡Gracias por tu pago y puntualidad!_`;

    const encoded = encodeURIComponent(mensaje);
    window.open(`https://wa.me/${tel}?text=${encoded}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl mx-auto bg-white p-6 shadow-2xl overflow-hidden [&>button]:hidden">
        <div className="flex flex-col items-center space-y-5">
          {/* Tarjeta del Ticket que se exporta como imagen */}
          <div
            ref={ticketRef}
            className="flex flex-col items-center space-y-4 bg-white p-4 pb-2 w-full text-slate-900"
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <img
                src="/logo.jpeg"
                alt="Logo Mercacrédito"
                className="h-14 w-auto object-contain mx-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {reciboData.esCorregido
                    ? "Comprobante de Pago (Actualizado)"
                    : "¡Pago Registrado con Éxito!"}
                </h2>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-widest">
                  Mercacrédito
                </p>
              </div>
            </div>

            <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
                <span className="font-semibold text-slate-500 uppercase tracking-wider">
                  Fecha
                </span>
                <span className="font-bold text-slate-900">{reciboData.fecha}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
                <span className="font-semibold text-slate-500 uppercase tracking-wider">
                  Cliente
                </span>
                <span className="font-bold text-slate-900 text-right max-w-[170px] truncate">
                  {reciboData.clienteNombre}
                </span>
              </div>

              {reciboData.numeroFactura && (
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">
                    Factura
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {reciboData.numeroFactura}
                  </span>
                </div>
              )}

              {reciboData.cobradorNombre && (
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">
                    Cobrador
                  </span>
                  <span className="font-semibold text-slate-700">
                    {reciboData.cobradorNombre}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pb-2.5 pt-1 border-b border-dashed border-slate-200 bg-emerald-50/70 -mx-2 px-2 py-1 rounded">
                <span className="font-bold text-emerald-800 uppercase tracking-wider">
                  Abono Realizado
                </span>
                <span className="text-base font-black text-emerald-700">
                  ${Number(reciboData.abono || 0).toLocaleString("es-CO")}
                </span>
              </div>

              {reciboData.tipoCredito === "Credicontado" ? (
                <>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Total Crédito</span>
                    <span className="font-semibold text-slate-900">
                      ${Number(reciboData.totalCredito || 0).toLocaleString("es-CO")}
                    </span>
                  </div>
                  {reciboData.totalCredicontado != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Total Credicontado</span>
                      <span className="font-semibold text-emerald-700">
                        ${Number(reciboData.totalCredicontado).toLocaleString("es-CO")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200">
                    <span className="font-bold text-amber-800 uppercase tracking-wider">
                      Saldo Crédito
                    </span>
                    <span className="font-black text-amber-700 text-sm">
                      ${Number(reciboData.saldoPendiente || 0).toLocaleString("es-CO")}
                    </span>
                  </div>
                  {reciboData.saldoCredicontado != null && !reciboData.penalidadAplicada && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-800 uppercase tracking-wider">
                        Saldo Credicontado
                      </span>
                      <span className="font-black text-emerald-700 text-sm">
                        ${Number(reciboData.saldoCredicontado).toLocaleString("es-CO")}
                      </span>
                    </div>
                  )}
                  {reciboData.fechaLimitePago && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500 font-medium">Límite Beneficio</span>
                      <span className="font-semibold text-slate-700">
                        {new Date(reciboData.fechaLimitePago + "T00:00:00").toLocaleDateString(
                          "es-CO",
                          {
                            timeZone: "America/Bogota",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Total Crédito</span>
                    <span className="font-semibold text-slate-900">
                      ${Number(reciboData.totalCredito || 0).toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200">
                    <span className="font-bold text-amber-800 uppercase tracking-wider">
                      Saldo Pendiente
                    </span>
                    <span className="font-black text-amber-700 text-sm">
                      ${Number(reciboData.saldoPendiente || 0).toLocaleString("es-CO")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="w-full space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full text-xs font-semibold h-10 rounded-xl"
                onClick={descargarRecibo}
              >
                <Download className="w-4 h-4 mr-1.5" /> Descargar
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs font-semibold h-10 rounded-xl"
                onClick={compartirRecibo}
              >
                <Share2 className="w-4 h-4 mr-1.5" /> Compartir
              </Button>
            </div>
            <Button
              className="w-full text-xs sm:text-sm font-bold h-11 rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 text-white flex items-center justify-center gap-2 shadow-sm"
              onClick={enviarWhatsApp}
            >
              <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs font-semibold h-9 text-muted-foreground"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

