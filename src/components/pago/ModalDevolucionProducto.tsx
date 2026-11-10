/**
 * ModalDevolucionProducto.tsx
 * Modal interactivo para procesar la devolución de mercancía al almacén,
 * ajuste de inventario, recálculo de cuotas y redirección de cuotas iniciales
 * o abonos previos hacia otros créditos o devolución en efectivo.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  RotateCcw,
  AlertTriangle,
  PackageCheck,
  Banknote,
  Receipt,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  obtenerCreditosDestinoParaCliente,
  obtenerResumenPagosCredito,
  procesarDevolucionProducto,
  type CreditoDestinoOpcion,
} from "@/services/devolucionService";
import type { ProductoVendidoDetalle } from "@/services/estadoCuentaService";
import { formatearMoneda } from "@/services/producto.service";

interface ModalDevolucionProductoProps {
  isOpen: boolean;
  onClose: () => void;
  creditoId: string;
  clienteId: string;
  clienteNombre: string;
  usuarioId: string;
  itemProducto?: ProductoVendidoDetalle | null;
  onSuccess: () => void;
}

export function ModalDevolucionProducto({
  isOpen,
  onClose,
  creditoId,
  clienteId,
  clienteNombre,
  usuarioId,
  itemProducto,
  onSuccess,
}: ModalDevolucionProductoProps) {
  const [motivo, setMotivo] = useState("");
  const [estadoFisico, setEstadoFisico] = useState<"Bueno" | "Garantia_Proveedor">("Bueno");
  const [destinoDinero, setDestinoDinero] = useState<
    "Abono_Otro_Credito" | "Devolucion_Efectivo" | "Saldo_Favor" | "Conservado_En_Compra"
  >("Abono_Otro_Credito");
  const [creditoDestinoId, setCreditoDestinoId] = useState<string>("");

  // Cantidad a devolver (para productos individuales)
  const [cantidadDevolver, setCantidadDevolver] = useState<number>(itemProducto?.cantidad || 1);

  useEffect(() => {
    if (itemProducto) {
      setCantidadDevolver(itemProducto.cantidad || 1);
    }
  }, [itemProducto]);

  // Limpiar estado al cerrar o abrir
  useEffect(() => {
    if (isOpen) {
      setMotivo("");
      setEstadoFisico("Bueno");
      setCreditoDestinoId("");
    }
  }, [isOpen]);

  // 1. Cargar resumen de pagos de este crédito
  const {
    data: resumenPagos,
    isLoading: loadingPagos,
  } = useQuery({
    queryKey: ["resumen-pagos-devolucion", creditoId],
    queryFn: () => obtenerResumenPagosCredito(creditoId),
    enabled: isOpen && !!creditoId,
  });

  // 2. Cargar otros créditos del cliente a los que se les podría abonar
  const {
    data: otrosCreditos = [],
    isLoading: loadingOtrosCreditos,
  } = useQuery({
    queryKey: ["otros-creditos-cliente", clienteId, creditoId],
    queryFn: () => obtenerCreditosDestinoParaCliente(clienteId, creditoId),
    enabled: isOpen && !!clienteId && !!creditoId,
  });

  // Seleccionar automáticamente el primer crédito disponible si hay
  useEffect(() => {
    if (otrosCreditos.length > 0 && !creditoDestinoId) {
      setCreditoDestinoId(otrosCreditos[0].id);
      setDestinoDinero("Abono_Otro_Credito");
    } else if (otrosCreditos.length === 0) {
      setDestinoDinero("Devolucion_Efectivo");
    }
  }, [otrosCreditos, creditoDestinoId]);

  const esDevolucionTotal = !itemProducto;
  const precioUnitario = itemProducto?.precioAplicado || 0;
  const subtotalMercancia = esDevolucionTotal
    ? (resumenPagos?.valorCredito || 0)
    : cantidadDevolver * precioUnitario;

  const totalPagado = resumenPagos?.totalPagado || 0;

  // Monto reconocido al cliente: el 100% de lo pagado (limitado al valor de la mercancía devuelta si es parcial)
  const montoReconocido = useMemo(() => {
    if (totalPagado <= 0) return 0;
    if (esDevolucionTotal) return totalPagado;
    return Math.min(totalPagado, subtotalMercancia);
  }, [totalPagado, esDevolucionTotal, subtotalMercancia]);

  // Crédito destino seleccionado
  const creditoDestinoSeleccionado = otrosCreditos.find((c) => c.id === creditoDestinoId);

  // Mutación de ejecución
  const mutationDevolucion = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) throw new Error("Debe ingresar un motivo para la devolución.");
      if (montoReconocido > 0 && destinoDinero === "Abono_Otro_Credito" && !creditoDestinoId) {
        throw new Error("Debe seleccionar el crédito al que se aplicará el abono.");
      }

      await procesarDevolucionProducto({
        creditoId,
        clienteId,
        usuarioId,
        esDevolucionTotal,
        productoId: itemProducto?.productoId,
        detalleVentaId: itemProducto?.id,
        productoNombre: itemProducto?.productoNombre,
        cantidadDevolver,
        precioAplicado: precioUnitario,
        subtotal: subtotalMercancia,
        motivo,
        estadoFisico,
        destinoDinero: montoReconocido > 0 ? destinoDinero : "Conservado_En_Compra",
        creditoDestinoId: destinoDinero === "Abono_Otro_Credito" ? creditoDestinoId : undefined,
        montoReconocido,
      });
    },
    onSuccess: () => {
      toast.success("Devolución procesada correctamente", {
        description: `El producto ha sido reingresado a bodega y los saldos fueron recalculados.`,
      });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error("Error al procesar la devolución", {
        description: err.message,
      });
    },
  });

  const handleSubmit = () => {
    mutationDevolucion.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <RotateCcw className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">
              {esDevolucionTotal ? "Devolución Total de Venta" : "Devolver Producto al Almacén"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Reingresa la mercancía a inventario, ajusta el crédito de <strong>{clienteNombre}</strong> y redirecciona el dinero pagado.
          </DialogDescription>
        </DialogHeader>

        {loadingPagos ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Consultando información contable...</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* FICHA RESUMEN DEL PRODUCTO / MERCANCÍA */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Factura Asociada:</span>
                <span className="font-mono font-bold bg-background px-2 py-0.5 rounded border border-border/50 text-[11px]">
                  {resumenPagos?.numeroFactura || "S/F"}
                </span>
              </div>

              {!esDevolucionTotal && itemProducto ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Producto a devolver:</span>
                    <span className="font-bold text-foreground text-right">{itemProducto.productoNombre}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Cantidad a devolver:</span>
                    <Badge variant="secondary" className="font-bold">
                      {cantidadDevolver} {cantidadDevolver === 1 ? "unidad" : "unidades"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground font-semibold">Valor mercancía que se descuenta:</span>
                    <span className="font-bold text-foreground">{formatearMoneda(subtotalMercancia)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground font-semibold">Total crédito a anular:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {formatearMoneda(resumenPagos?.valorCredito || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: TRATAMIENTO DEL DINERO PAGADO (CUOTA INICIAL / ABONOS) */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Banknote className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    Dinero Pagado por el Cliente: {formatearMoneda(totalPagado)}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {totalPagado > 0
                      ? `Se reconoce el 100% de lo cancelado (${formatearMoneda(montoReconocido)}) por políticas del negocio.`
                      : "El cliente no tiene cuotas iniciales ni abonos registrados en esta venta ($0)."}
                  </p>
                </div>
              </div>

              {montoReconocido > 0 && (
                <div className="pt-2 border-t border-amber-500/20 space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    ¿Qué deseas hacer con los {formatearMoneda(montoReconocido)} pagados?
                  </Label>

                  <RadioGroup
                    value={destinoDinero}
                    onValueChange={(val: any) => setDestinoDinero(val)}
                    className="space-y-2"
                  >
                    {/* OPCIÓN 1: ABONAR A OTRO CRÉDITO */}
                    <div
                      className={`flex items-start space-x-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer ${
                        destinoDinero === "Abono_Otro_Credito"
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/30"
                      }`}
                      onClick={() => setDestinoDinero("Abono_Otro_Credito")}
                    >
                      <RadioGroupItem value="Abono_Otro_Credito" id="opt-abono" className="mt-1" />
                      <div className="flex-1 text-xs">
                        <label htmlFor="opt-abono" className="font-semibold text-foreground cursor-pointer">
                          Abonar a otro crédito del cliente
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Traslada este dinero como un abono a otra factura pendiente del mismo cliente.
                        </p>

                        {destinoDinero === "Abono_Otro_Credito" && (
                          <div className="mt-2.5">
                            {loadingOtrosCreditos ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando créditos...
                              </div>
                            ) : otrosCreditos.length === 0 ? (
                              <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                                Este cliente no tiene otros créditos activos con saldo pendiente. Selecciona devolución en efectivo.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                <Select
                                  value={creditoDestinoId}
                                  onValueChange={setCreditoDestinoId}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background">
                                    <SelectValue placeholder="Selecciona la factura a abonar..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {otrosCreditos.map((c) => (
                                      <SelectItem key={c.id} value={c.id} className="text-xs">
                                        Factura {c.numeroFactura} — Saldo: {formatearMoneda(c.saldoPendiente)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {creditoDestinoSeleccionado && (
                                  <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      Nuevo saldo Factura {creditoDestinoSeleccionado.numeroFactura}:{" "}
                                      <strong>
                                        {formatearMoneda(
                                          Math.max(0, creditoDestinoSeleccionado.saldoPendiente - montoReconocido)
                                        )}
                                      </strong>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* OPCIÓN 2: DEVOLUCIÓN EN EFECTIVO */}
                    <div
                      className={`flex items-start space-x-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer ${
                        destinoDinero === "Devolucion_Efectivo"
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/30"
                      }`}
                      onClick={() => setDestinoDinero("Devolucion_Efectivo")}
                    >
                      <RadioGroupItem value="Devolucion_Efectivo" id="opt-efectivo" className="mt-1" />
                      <div className="flex-1 text-xs">
                        <label htmlFor="opt-efectivo" className="font-semibold text-foreground cursor-pointer">
                          Devolver dinero en efectivo al cliente
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Se reintegran {formatearMoneda(montoReconocido)} en físico al cliente y queda registrado el egreso.
                        </p>
                      </div>
                    </div>

                    {/* OPCIÓN 3: SALDO A FAVOR / CAMBIO DE PRODUCTO */}
                    <div
                      className={`flex items-start space-x-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer ${
                        destinoDinero === "Saldo_Favor"
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/30"
                      }`}
                      onClick={() => setDestinoDinero("Saldo_Favor")}
                    >
                      <RadioGroupItem value="Saldo_Favor" id="opt-saldo" className="mt-1" />
                      <div className="flex-1 text-xs">
                        <label htmlFor="opt-saldo" className="font-semibold text-foreground cursor-pointer">
                          Saldo a favor / Cambio por otro producto
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          El cliente llevará otra mercancía y este monto entrará como cuota inicial en su nueva venta.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            {/* SECCIÓN 3: ESTADO FÍSICO Y MOTIVO */}
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs font-semibold text-foreground">Estado físico del producto</Label>
                <Select
                  value={estadoFisico}
                  onValueChange={(val: any) => setEstadoFisico(val)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bueno" className="text-xs">
                      En buen estado (Reingresa a bodega para nueva venta)
                    </SelectItem>
                    <SelectItem value="Garantia_Proveedor" className="text-xs">
                      Por garantía (Reemplazo con proveedor)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">
                  Motivo de la devolución <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Escribe el motivo detallado (ej. cliente desistió de la compra, cambio de mercancía, garantía)..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="mt-1 text-xs min-h-[75px] resize-none"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={mutationDevolucion.isPending}
            className="rounded-xl text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleSubmit}
            disabled={mutationDevolucion.isPending || !motivo.trim() || loadingPagos}
            className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 font-bold"
          >
            {mutationDevolucion.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Procesando Devolución...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Confirmar Devolución al Almacén
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
