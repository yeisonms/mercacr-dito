import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toPng, toBlob } from 'html-to-image';
import {
  Camera, X, Loader2, Navigation, MapPin, DollarSign, Info, CheckCircle2,
  Download, Share2, MessageCircle
} from "lucide-react";

import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { registrarRecaudo, type CreditoCobro } from "@/services/recaudoService";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase"; 

export const formatearMoneda = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor);
};

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
}

const recaudoSchema = z.object({
  valor_recibido: z.coerce
    .number({ invalid_type_error: "El valor recibido debe ser un número" })
    .min(1, "El valor recibido debe ser mayor a 0"),
  metodo_pago: z.enum(["Efectivo", "Transferencia"]),
  observaciones: z.string().optional(),
});

type RecaudoFormValues = z.infer<typeof recaudoSchema>;

interface ModalPagoProps {
  isOpen: boolean;
  onClose: () => void;
  creditoSeleccionado: CreditoCobro | null;
  onSuccess?: () => void;
}

export function ModalPago({ isOpen, onClose, creditoSeleccionado, onSuccess }: ModalPagoProps) {
  const queryClient = useQueryClient();
  const { perfil } = useAuth();
  
  const [cuotaSugerida, setCuotaSugerida] = useState<number | null>(null);
  const [reciboData, setReciboData] = useState<ReciboData | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  
  const [fotoSoporte, setFotoSoporte] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const form = useForm<RecaudoFormValues>({
    resolver: zodResolver(recaudoSchema),
    defaultValues: {
      valor_recibido: undefined,
      metodo_pago: "Efectivo",
      observaciones: "",
    },
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue } = form;

  useEffect(() => {
    if (isOpen && creditoSeleccionado) {
      if (reciboData !== null) return;
      
      setReciboData(null);
      setFotoSoporte(null);
      setFotoPreview(null);
      
      const cargarSugerencia = async () => {
        try {
          const { data, error } = await supabase
            .from("cuotas")
            .select("saldo_cuota")
            .eq("credito_id", creditoSeleccionado.id)
            .in("estado", ["Pendiente", "Parcial"])
            .order("numero_cuota", { ascending: true })
            .limit(1)
            .single();

          if (!error && data) {
            const valor = Number(data.saldo_cuota);
            setCuotaSugerida(valor);
            reset({
              valor_recibido: valor,
              metodo_pago: "Efectivo",
              observaciones: "",
            });
            return;
          }
        } catch (err) {
          console.error("Error obteniendo cuota sugerida:", err);
        }
        
        setCuotaSugerida(null);
        reset({
          valor_recibido: undefined,
          metodo_pago: "Efectivo",
          observaciones: "",
        });
      };
      cargarSugerencia();
    }
  }, [isOpen, creditoSeleccionado, reset]);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("La imagen es demasiado grande. Máximo 10MB.");
        return;
      }
      setFotoSoporte(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const removerFoto = () => {
    setFotoSoporte(null);
    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
    }
  };

  const mutation = useMutation({
    mutationFn: registrarRecaudo,
    onSuccess: (recaudoId, variables) => {
      toast.success("Pago registrado correctamente");
      
      if (creditoSeleccionado) {
        let nvoSaldo = Math.max(0, creditoSeleccionado.saldo_pendiente - variables.valorRecibido);
        let nvoSaldoContado = creditoSeleccionado.saldo_contado != null 
          ? Math.max(0, creditoSeleccionado.saldo_contado - variables.valorRecibido) 
          : null;
        
        setReciboData({
          fecha: new Date().toLocaleString("es-CO", { 
            timeZone: "America/Bogota",
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true 
          }).replace(',', ''),
          clienteNombre: `${creditoSeleccionado.cliente.nombres} ${creditoSeleccionado.cliente.apellidos}`,
          abono: variables.valorRecibido,
          totalCredito: creditoSeleccionado.valor_credito,
          saldoPendiente: nvoSaldo,
          telefono: creditoSeleccionado.cliente.telefono_principal,
          tipoCredito: creditoSeleccionado.tipo_venta,
          totalCredicontado: creditoSeleccionado.valor_contado,
          saldoCredicontado: nvoSaldoContado,
          penalidadAplicada: creditoSeleccionado.penalidad_aplicada,
          fechaLimitePago: creditoSeleccionado.fecha_limite_credicontado,
        });
      }
      
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar el pago");
    }
  });

  const onSubmit = (values: RecaudoFormValues) => {
    if (!creditoSeleccionado) return;

    mutation.mutate({
      creditoId: creditoSeleccionado.id,
      valorRecibido: values.valor_recibido,
      metodoPago: values.metodo_pago,
      fotoDinero: fotoSoporte,
      observaciones: values.observaciones,
      usuarioId: perfil?.id,
    });
  };

  const handleCerrar = () => {
    removerFoto();
    reset();
    onClose();
  };

  const descargarRecibo = async () => {
    if (!ticketRef.current || !reciboData) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Recibo_Mercacredito_${reciboData.clienteNombre.replace(/\s+/g, "_")}.png`;
      link.click();
    } catch (err) {
      toast.error("Error al descargar el recibo");
    }
  };

  const compartirRecibo = async () => {
    if (!ticketRef.current || !reciboData) return;
    try {
      const blob = await toBlob(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      if (!blob) throw new Error("No se pudo generar");
      const file = new File([blob], `Recibo_Mercacredito_${reciboData.clienteNombre.replace(/\s+/g, "_")}.png`, { type: blob.type });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        toast.info("Compartir imágenes no está soportado en este dispositivo. Utiliza la opción descargar.");
      }
    } catch (err) {
      toast.error("Error al intentar compartir el recibo.");
    }
  };

  const enviarWhatsApp = () => {
    if (!reciboData) return;
    const { clienteNombre, abono, saldoPendiente, saldoCredicontado, penalidadAplicada, fechaLimitePago, telefono } = reciboData;
    let tel = telefono.replace(/\D/g, "");
    if (!tel.startsWith("57") && tel.length === 10) tel = "57" + tel;
    
    let mensaje = `*MERCACRÉDITO - PAGO REGISTRADO*\n\n`;
    mensaje += `Hola *${clienteNombre}*, confirmamos el pago de tu cuota.\n\n`;
    mensaje += `✅ *Abono Realizado:* $${abono.toLocaleString()}\n`;
    mensaje += `⚠️ *Saldo Crédito:* $${saldoPendiente.toLocaleString()}\n`;
    
    if (saldoCredicontado !== undefined && saldoCredicontado !== null && !penalidadAplicada) {
      mensaje += `⚠️ *Saldo Credicontado:* $${saldoCredicontado.toLocaleString()}\n`;
    }
    
    if (fechaLimitePago) {
      const fechaLimite = new Date(fechaLimitePago + "T00:00:00").toLocaleDateString("es-CO", { 
        timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" 
      });
      mensaje += `⏰ *Límite Beneficio:* ${fechaLimite}\n`;
    }
    
    mensaje += `\n_¡Gracias por tu pago!_`;
    
    const encoded = encodeURIComponent(mensaje);
    window.open(`https://wa.me/${tel}?text=${encoded}`, "_blank");
  };

  return (
    <>
      <Drawer open={isOpen && !reciboData} onOpenChange={(open) => !open && handleCerrar()}>
        <DrawerContent className="max-w-md mx-auto">
          {creditoSeleccionado && (
            <Tabs defaultValue="pago" className="w-full">
              <DrawerHeader className="text-left pb-2">
                <DrawerTitle className="text-lg font-bold">Registro de Pago</DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  Cliente: <strong>{creditoSeleccionado.cliente.nombres} {creditoSeleccionado.cliente.apellidos}</strong>
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="pago">Recibir Abono</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pago">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="px-4 space-y-4 mt-2">
                    <div className="flex flex-col gap-2">
                      {creditoSeleccionado.tipo_venta === "Credicontado" && !creditoSeleccionado.penalidad_aplicada && creditoSeleccionado.saldo_contado != null ? (
                        <div className="flex w-full justify-between gap-4">
                          <div className="flex-1 rounded-xl bg-muted/30 p-3 flex flex-col justify-center text-center">
                            <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">Saldo Crédito</span>
                            <span className="text-lg font-bold text-foreground">{formatearMoneda(creditoSeleccionado.saldo_pendiente)}</span>
                          </div>
                          <div className="flex-1 rounded-xl bg-emerald-500/10 p-3 flex flex-col justify-center text-center border border-emerald-500/20">
                            <span className="text-2xs uppercase tracking-wider font-bold text-emerald-700">Saldo Credicontado</span>
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatearMoneda(creditoSeleccionado.saldo_contado)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 rounded-xl bg-muted/30 p-3 flex flex-col justify-center items-center text-center w-full">
                          <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">Saldo Pendiente Actual</span>
                          <p className="text-xl font-black text-primary">
                            {formatearMoneda(creditoSeleccionado.saldo_pendiente)}
                          </p>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setValue("valor_recibido", 
                            creditoSeleccionado.tipo_venta === "Credicontado" && !creditoSeleccionado.penalidad_aplicada && creditoSeleccionado.saldo_contado != null 
                            ? creditoSeleccionado.saldo_contado 
                            : creditoSeleccionado.saldo_pendiente
                          )
                        }
                        className="text-xs font-semibold h-8 border-primary/20 hover:bg-primary/10 hover:text-primary"
                      >
                        Pagar Total
                      </Button>
                    </div>

                    {creditoSeleccionado.cliente.latitud !== null && creditoSeleccionado.cliente.longitud !== null && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" className="flex-1 text-xs gap-1.5 h-9" asChild>
                            <a href={`https://waze.com/ul?ll=${creditoSeleccionado.cliente.latitud},${creditoSeleccionado.cliente.longitud}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                              <Navigation className="h-3.5 w-3.5" /> Waze
                            </a>
                          </Button>
                          <Button type="button" variant="secondary" className="flex-1 text-xs gap-1.5 h-9" asChild>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${creditoSeleccionado.cliente.latitud},${creditoSeleccionado.cliente.longitud}`} target="_blank" rel="noopener noreferrer">
                              <MapPin className="h-3.5 w-3.5" /> Maps
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Método de Pago</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center justify-center gap-2 border rounded-xl p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors text-center">
                          <input type="radio" value="Efectivo" className="accent-primary w-4 h-4" {...register("metodo_pago")} />
                          <span className="text-sm font-medium">Efectivo</span>
                        </label>
                        <label className="flex items-center justify-center gap-2 border rounded-xl p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors text-center">
                          <input type="radio" value="Transferencia" className="accent-primary w-4 h-4" {...register("metodo_pago")} />
                          <span className="text-sm font-medium">Transferencia</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>Valor Recibido <span className="text-destructive">*</span></span>
                        {cuotaSugerida !== null && (
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
                            Sugerida: {formatearMoneda(cuotaSugerida)}
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input type="number" inputMode="numeric" placeholder="0" {...register("valor_recibido")} className="h-11 pl-9 text-base rounded-lg shadow-2xs" />
                      </div>
                      {errors.valor_recibido && (
                        <p className="text-2xs text-destructive font-medium flex items-center gap-1">
                          <Info className="h-3 w-3 shrink-0" /> {errors.valor_recibido.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>Foto del Comprobante / Dinero</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Opcional</span>
                      </label>
                      {!fotoPreview ? (
                        <div className="relative border border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors">
                          <input type="file" accept="image/*" onChange={handleFotoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                              <Camera className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-primary block">Tomar Foto / Subir Imagen</span>
                              <span className="text-[10px] text-muted-foreground">Formato JPG, PNG. Máx. 10MB</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative border rounded-xl overflow-hidden bg-muted/20">
                          <img src={fotoPreview} alt="Previsualización soporte" className="w-full h-32 object-contain bg-black/5 dark:bg-black/20" />
                          <button type="button" onClick={removerFoto} className="absolute top-2 right-2 h-7 w-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground block">Observaciones (Opcional)</label>
                      <Textarea placeholder="Comentarios o notas sobre el recaudo..." {...register("observaciones")} className="min-h-[70px] resize-none text-sm rounded-lg" />
                    </div>
                  </div>

                  <DrawerFooter className="pt-2 gap-2">
                    <Button type="submit" disabled={mutation.isPending} className="h-11 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 shadow-sm">
                      {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando Pago...</> : <>Registrar Pago</>}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCerrar} disabled={mutation.isPending} className="h-10 text-xs rounded-xl">Cancelar</Button>
                  </DrawerFooter>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DrawerContent>
      </Drawer>

      <Dialog open={reciboData !== null} onOpenChange={(open) => {
        if (!open) {
          setReciboData(null);
          handleCerrar();
        }
      }}>
        <DialogContent className="max-w-sm rounded-2xl mx-auto bg-white p-6 shadow-2xl overflow-hidden [&>button]:hidden">
          {reciboData && (
            <div className="flex flex-col items-center space-y-6">
              <div ref={ticketRef} className="flex flex-col items-center space-y-4 bg-white p-4 pb-2 w-full">
                <div className="flex flex-col items-center text-center space-y-3">
                  <img src="/logo.jpeg" alt="Logo Mercacrédito" className="h-16 w-auto object-contain mx-auto" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-foreground tracking-tight">¡Pago Registrado con Éxito!</h2>
                    <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest">Mercacrédito</p>
                  </div>
                </div>

                <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Pago</span>
                    <span className="text-sm font-bold text-foreground">{reciboData.fecha}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</span>
                    <span className="text-sm font-bold text-foreground text-right max-w-[150px] truncate">{reciboData.clienteNombre}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200 bg-emerald-50/50 -mx-2 px-2 py-1 rounded">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Abono Realizado</span>
                    <span className="text-base font-black text-emerald-600">${reciboData.abono.toLocaleString()}</span>
                  </div>
                  {reciboData.tipoCredito === "Credicontado" ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground">Total del Crédito</span>
                        <span className="text-sm font-medium text-foreground">${reciboData.totalCredito.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-medium text-muted-foreground">Total Credicontado</span>
                        <span className="text-sm font-medium text-emerald-600">${reciboData.totalCredicontado?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 mt-2">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Saldo Crédito</span>
                        <span className="text-sm font-black text-amber-600">${reciboData.saldoPendiente.toLocaleString()}</span>
                      </div>
                      {reciboData.saldoCredicontado !== undefined && reciboData.saldoCredicontado !== null && !reciboData.penalidadAplicada && (
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Saldo Credicontado</span>
                          <span className="text-sm font-black text-emerald-600">${reciboData.saldoCredicontado.toLocaleString()}</span>
                        </div>
                      )}
                      {reciboData.fechaLimitePago && (
                        <div className="flex justify-between items-center pt-2 mt-2">
                          <span className="text-xs font-medium text-muted-foreground">Límite Beneficio</span>
                          <span className="text-xs font-medium text-foreground">
                            {new Date(reciboData.fechaLimitePago + "T00:00:00").toLocaleDateString("es-CO", { 
                              timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" 
                            })}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground">Total del Crédito</span>
                        <span className="text-sm font-medium text-foreground">${reciboData.totalCredito.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Saldo Pendiente</span>
                        <span className="text-sm font-black text-amber-600">${reciboData.saldoPendiente.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="w-full space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full text-xs font-semibold h-11 rounded-xl" onClick={descargarRecibo}>
                    <Download className="w-4 h-4 mr-2" /> Descargar
                  </Button>
                  <Button variant="outline" className="w-full text-xs font-semibold h-11 rounded-xl" onClick={compartirRecibo}>
                    <Share2 className="w-4 h-4 mr-2" /> Compartir
                  </Button>
                </div>
                <Button className="w-full text-sm font-bold h-12 rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 text-white flex items-center justify-center gap-2 shadow-sm" onClick={enviarWhatsApp}>
                  <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
                </Button>
                <Button variant="ghost" className="w-full text-xs font-semibold h-10 text-muted-foreground" onClick={() => {
                  setReciboData(null);
                  handleCerrar();
                }}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
