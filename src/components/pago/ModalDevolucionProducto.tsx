/**
 * ModalDevolucionProducto.tsx
 * Modal interactivo para procesar la devolución de mercancía al almacén,
 * ajuste de inventario, recálculo de cuotas y redirección de cuotas iniciales
 * o abonos previos hacia otros créditos, hacia la misma compra o devolución en efectivo.
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
  ShoppingBag,
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
  productosEnCredito?: ProductoVendidoDetalle[];
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
  productosEnCredito = [],
  onSuccess,
}: ModalDevolucionProductoProps) {
  const [motivo, setMotivo] = useState("");
  const [estadoFisico, setEstadoFisico] = useState<"Bueno" | "Garantia_Proveedor">("Bueno");
  const [destinoDinero, setDestinoDinero] = useState<
    "Conservado_En_Compra" | "Abono_Otro_Credito" | "Devolucion_Efectivo" | "Saldo_Favor"
  >("Conservado_En_Compra");
  const [creditoDestinoId, setCreditoDestinoId] = useState<string>("");

  // Cantidad a devolver (para productos individuales)
  const [cantidadDevolver, setCantidadDevolver] = useState<number>(itemProducto?.cantidad || 1);

  // Otros productos que el cliente conserva en este mismo crédito
  const otrosProductosEnEsteCredito = useMemo(() => {
    if (!itemProducto || !productosEnCredito) return [];
    return productosEnCredito.filter((p) => p.id !== itemProducto.id);
  }, [itemProducto, productosEnCredito]);

  const tieneOtrosProductos = otrosProductosEnEsteCredito.length > 0;

  // Valor total de los otros productos que el cliente se queda
  const valorProductosRestantes = useMemo(() => {
    return otrosProductosEnEsteCredito.reduce((acc, p) => acc + p.subtotal, 0);
  }, [otrosProductosEnEsteCredito]);

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

  // 2. Cargar otras facturas/créditos del cliente a los que se les podría abonar
  const {
    data: otrosCreditos = [],
    isLoading: loadingOtrosCreditos,
  } = useQuery({
    queryKey: ["otros-creditos-cliente", clienteId, creditoId],
    queryFn: () => obtenerCreditosDestinoParaCliente(clienteId, creditoId),
    enabled: isOpen && !!clienteId && !!creditoId,
  });

  // Configurar automáticamente el destino recomendado del dinero
  useEffect(() => {
    if (tieneOtrosProductos) {
      // Si el cliente tiene otros productos en esta compra, lo natural es abonar al saldo restante
      setDestinoDinero("Conservado_En_Compra");
    } else if (otrosCreditos.length > 0) {
      setCreditoDestinoId(otrosCreditos[0].id);
      setDestinoDinero("Abono_Otro_Credito");
    } else {
      setDestinoDinero("Devolucion_Efectivo");
    }
  }, [tieneOtrosProductos, otrosCreditos]);

  const esDevolucionTotal = !itemProducto;
  const precioUnitario = itemProducto?.precioAplicado || 0;
  const subtotalMercancia = esDevolucionTotal
    ? (resumenPagos?.valorCredito || 0)
    : cantidadDevolver * precioUnitario;

  const totalPagado = resumenPagos?.totalPagado || 0;

  // Monto reconocido al cliente: el 100% de lo pagado
  const montoReconocido = useMemo(() => {
    if (totalPagado <= 0) return 0;
    if (esDevolucionTotal) return totalPagado;
    return Math.min(totalPagado, subtotalMercancia);
  }, [totalPagado, esDevolucionTotal, subtotalMercancia]);

  // Crédito destino seleccionado (en caso de elegir otra factura)
  const creditoDestinoSeleccionado = otrosCreditos.find((c) => c.id === creditoDestinoId);

  // Mutación de ejecución
  const mutationDevolucion = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) throw new Error("Debe ingresar un motivo para la devolución.");
      if (montoReconocido > 0 && destinoDinero === "Abono_Otro_Credito" && !creditoDestinoId) {
        throw new Error("Debe seleccionar la otra factura a la que se aplicará el abono.");
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
        description: `El producto ha sido reingresado a bodega y los saldos fueron recalculados con éxito.`,
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
                    {/* OPCIÓN 1: ABONAR A LOS PRODUCTOS QUE CONSERVA EN ESTA MISMA COMPRA (SI TIENE MÁS PRODUCTOS) */}
                    {tieneOtrosProductos && (
                      <div
                        className={`flex items-start space-x-2.5 rounded-lg border p-3 transition-colors cursor-pointer ${
                          destinoDinero === "Conservado_En_Compra"
                            ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                            : "border-border/60 hover:bg-muted/30"
                        }`}
                        onClick={() => setDestinoDinero("Conservado_En_Compra")}
                      >
                        <RadioGroupItem value="Conservado_En_Compra" id="opt-conservado" className="mt-1 text-emerald-600" />
                        <div className="flex-1 text-xs">
                          <div className="flex items-center gap-2">
                            <label htmlFor="opt-conservado" className="font-bold text-foreground cursor-pointer">
                              Abonar a la mercancía que conserva en esta compra
                            </label>
                            <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                              Recomendado
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            El cliente conserva:{" "}
                            <strong className="text-foreground">
                              {otrosProductosEnEsteCredito.map((p) => p.productoNombre).join(", ")}
                            </strong>
                            . Los {formatearMoneda(montoReconocido)} pagados se mantienen como abono a su deuda restante.
                          </p>

                          {destinoDinero === "Conservado_En_Compra" && (
                            <div className="mt-2.5 rounded-md border border-emerald-500/20 bg-background/80 p-2.5 space-y-1 text-[11px]">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Valor mercancía que conserva:</span>
                                <span className="font-semibold text-foreground">{formatearMoneda(valorProductosRestantes)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                <span>Abono reconocido (cuota inicial / abonos):</span>
                                <span className="font-bold">-{formatearMoneda(montoReconocido)}</span>
                              </div>
                              <div className="flex justify-between border-t border-border/50 pt-1 font-bold text-foreground">
                                <span>Nuevo saldo pendiente a pagar:</span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {formatearMoneda(Math.max(0, valorProductosRestantes - montoReconocido))}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* OPCIÓN 2: ABONAR A OTRA FACTURA DIFERENTE DEL CLIENTE */}
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
                          Abonar a otra factura del cliente (Crédito diferente)
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Traslada este dinero como un abono a otra factura independiente del mismo cliente.
                        </p>

                        {destinoDinero === "Abono_Otro_Credito" && (
                          <div className="mt-2.5">
                            {loadingOtrosCreditos ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando otras facturas...
                              </div>
                            ) : otrosCreditos.length === 0 ? (
                              <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                                El cliente no tiene otras facturas distintas con saldo pendiente.
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

                    {/* OPCIÓN 3: DEVOLUCIÓN EN EFECTIVO */}
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

                    {/* OPCIÓN 4: SALDO A FAVOR / CAMBIO DE PRODUCTO */}
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
                  placeholder="Escribe el motivo detallado (ej. cliente desistió de la almohada, cambio de mercancía, garantía)..."
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
