import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Share2, MessageCircle } from "lucide-react";
import { toPng, toBlob } from 'html-to-image';
import { toast } from "sonner";

export interface TicketVentaData {
  fecha: string;
  clienteNombre: string;
  numeroFactura: string;
  tipoVenta: string;
  totalVenta: number;
  totalCredicontado: number | null;
  abonoInicial: number;
  saldoPendiente: number;
  fechaLimiteCredicontado: string | null;
  telefono: string;
}

interface ModalTicketVentaProps {
  isOpen: boolean;
  onClose: () => void;
  ticketData: TicketVentaData | null;
}

export function ModalTicketVenta({ isOpen, onClose, ticketData }: ModalTicketVentaProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  const descargarTicket = async () => {
    if (!ticketRef.current || !ticketData) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { quality: 1, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Venta-${ticketData.clienteNombre.replace(/\s+/g, '-')}-${ticketData.numeroFactura}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Ticket descargado correctamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al descargar el ticket");
    }
  };

  const compartirTicket = async () => {
    if (!ticketRef.current || !ticketData) return;
    try {
      const blob = await toBlob(ticketRef.current, { quality: 1, backgroundColor: '#ffffff' });
      if (!blob) throw new Error("No se pudo generar la imagen");
      
      const file = new File([blob], `Venta-${ticketData.numeroFactura}.png`, { type: 'image/png' });
      
      if (navigator.share) {
        await navigator.share({
          title: `Detalle de Venta - ${ticketData.clienteNombre}`,
          text: `Hola ${ticketData.clienteNombre}, adjunto el comprobante de tu nueva compra.`,
          files: [file],
        });
      } else {
        toast.error("Tu navegador no soporta compartir archivos directamente");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al compartir el ticket");
    }
  };

  const enviarWhatsApp = async () => {
    if (!ticketRef.current || !ticketData) return;
    
    // Generar el mensaje
    let mensaje = `*MERCACRÉDITO - NUEVA VENTA*\n\n`;
    mensaje += `👤 *Cliente:* ${ticketData.clienteNombre}\n`;
    mensaje += `📄 *Factura:* ${ticketData.numeroFactura}\n`;
    mensaje += `📅 *Fecha:* ${ticketData.fecha}\n\n`;
    
    if (ticketData.tipoVenta.includes("Credicontado")) {
      mensaje += `💰 *Total Crédito:* $${ticketData.totalVenta.toLocaleString()}\n`;
      if (ticketData.totalCredicontado) {
        mensaje += `💰 *Total Credicontado:* $${ticketData.totalCredicontado.toLocaleString()}\n`;
      }
      mensaje += `✅ *Abono Inicial:* $${ticketData.abonoInicial.toLocaleString()}\n`;
      mensaje += `⚠️ *Saldo Crédito:* $${ticketData.saldoPendiente.toLocaleString()}\n`;
      
      if (ticketData.fechaLimiteCredicontado) {
        const fechaLimite = new Date(ticketData.fechaLimiteCredicontado + "T00:00:00").toLocaleDateString("es-CO", { 
          timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" 
        });
        mensaje += `⏰ *Límite Beneficio:* ${fechaLimite}\n`;
      }
    } else {
      mensaje += `💰 *Total Venta:* $${ticketData.totalVenta.toLocaleString()}\n`;
      mensaje += `✅ *Abono Inicial:* $${ticketData.abonoInicial.toLocaleString()}\n`;
      mensaje += `⚠️ *Saldo Pendiente:* $${ticketData.saldoPendiente.toLocaleString()}\n`;
    }
    
    mensaje += `\n_Gracias por su compra_`;
    
    // Formatear el número de teléfono
    let telefonoFormateado = ticketData.telefono.replace(/\D/g, "");
    if (!telefonoFormateado.startsWith("57")) {
      telefonoFormateado = "57" + telefonoFormateado;
    }
    
    const url = `https://wa.me/${telefonoFormateado}?text=${encodeURIComponent(mensaje)}`;
    
    window.open(url, '_blank');
    
    try {
      await descargarTicket();
    } catch(e) {
      console.log("No se pudo autodescargar", e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl mx-auto bg-white p-6 shadow-2xl overflow-hidden [&>button]:hidden">
        {ticketData && (
          <div className="flex flex-col items-center space-y-6">
            
            {/* Contenedor completo para descargar (incluye logo, check y body) */}
            <div ref={ticketRef} className="flex flex-col items-center space-y-4 bg-white p-4 pb-2 w-full">
              {/* Header */}
              <div className="flex flex-col items-center text-center space-y-3">
                <img 
                  src="/logo.jpeg" 
                  alt="Logo Mercacrédito" 
                  className="h-16 w-auto object-contain mx-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-foreground tracking-tight">¡Venta Exitosa!</h2>
                  <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest">Mercacrédito</p>
                </div>
              </div>

              {/* Ticket Body */}
              <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha</span>
                  <span className="text-sm font-bold text-foreground">{ticketData.fecha}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Factura</span>
                  <span className="text-sm font-bold text-foreground">#{ticketData.numeroFactura}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</span>
                  <span className="text-sm font-bold text-foreground text-right max-w-[150px] truncate">{ticketData.clienteNombre}</span>
                </div>
                
                {ticketData.abonoInicial > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200 bg-blue-50/50 -mx-2 px-2 py-1 rounded">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Abono Inicial</span>
                    <span className="text-base font-black text-blue-600">${ticketData.abonoInicial.toLocaleString()}</span>
                  </div>
                )}
                
                {ticketData.tipoVenta.includes("Credicontado") ? (
                  <>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs font-medium text-muted-foreground">Total del Crédito</span>
                      <span className="text-sm font-medium text-foreground">${ticketData.totalVenta.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs font-medium text-muted-foreground">Total Credicontado</span>
                      <span className="text-sm font-medium text-blue-600">${ticketData.totalCredicontado?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 mt-2">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Saldo Crédito</span>
                      <span className="text-sm font-black text-amber-600">${ticketData.saldoPendiente.toLocaleString()}</span>
                    </div>
                    {ticketData.fechaLimiteCredicontado && (
                      <div className="flex justify-between items-center pt-2 mt-2">
                        <span className="text-xs font-medium text-muted-foreground">Límite Beneficio</span>
                        <span className="text-xs font-medium text-foreground">
                          {new Date(ticketData.fechaLimiteCredicontado + "T00:00:00").toLocaleDateString("es-CO", { 
                            timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" 
                          })}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs font-medium text-muted-foreground">Total de Venta</span>
                      <span className="text-sm font-medium text-foreground">${ticketData.totalVenta.toLocaleString()}</span>
                    </div>
                    {ticketData.tipoVenta !== "Contado" && (
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Saldo Pendiente</span>
                        <span className="text-sm font-black text-amber-600">${ticketData.saldoPendiente.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full text-xs font-semibold h-11 rounded-xl" onClick={descargarTicket}>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
                <Button variant="outline" className="w-full text-xs font-semibold h-11 rounded-xl" onClick={compartirTicket}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartir
                </Button>
              </div>
              <Button 
                className="w-full text-sm font-bold h-12 rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 text-white flex items-center justify-center gap-2 shadow-sm"
                onClick={enviarWhatsApp}
              >
                <MessageCircle className="w-5 h-5" />
                Enviar Factura por WhatsApp
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-xs font-semibold h-10 text-muted-foreground"
                onClick={onClose}
              >
                Cerrar y Continuar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
