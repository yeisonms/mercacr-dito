import { useState, useMemo, useRef } from "react";
import {
  Printer,
  Tag,
  Copy,
  Plus,
  Minus,
  Settings2,
  FileDown,
  Info,
  Check,
  RotateCcw,
} from "lucide-react";
import jsPDF from "jspdf";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatearMoneda, type Producto } from "@/services/producto.service";

interface ItemEtiqueta {
  producto: Producto;
  cantidad: number;
}

interface ModalImprimirEtiquetasProps {
  isOpen: boolean;
  onClose: () => void;
  productosDisponibles: Producto[];
  productoSeleccionado?: Producto | null;
}

type EstiloPrecio = "ambos" | "solo_contado" | "solo_credito";

export function ModalImprimirEtiquetas({
  isOpen,
  onClose,
  productosDisponibles,
  productoSeleccionado,
}: ModalImprimirEtiquetasProps) {
  // Lista de items a imprimir
  const [items, setItems] = useState<ItemEtiqueta[]>(() => {
    if (productoSeleccionado) {
      return [{ producto: productoSeleccionado, cantidad: 3 }]; // 3 para llenar 1 fila exacta
    }
    return [];
  });

  // Selector para agregar más productos
  const [productoAAgregarId, setProductoAAgregarId] = useState<string>("");

  // Opciones de configuración de la etiqueta
  const [estiloPrecio, setEstiloPrecio] = useState<EstiloPrecio>("ambos");
  const [mostrarNombreNegocio, setMostrarNombreNegocio] = useState<boolean>(true);
  const [mostrarCodigo, setMostrarCodigo] = useState<boolean>(true);
  const [columnaInicial, setColumnaInicial] = useState<number>(1); // 1, 2 o 3

  // Sincronizar cuando cambie el producto seleccionado al abrir
  const [ultimoProductoId, setUltimoProductoId] = useState<string | undefined>(
    productoSeleccionado?.id
  );
  if (productoSeleccionado && productoSeleccionado.id !== ultimoProductoId) {
    setUltimoProductoId(productoSeleccionado.id);
    setItems([{ producto: productoSeleccionado, cantidad: 3 }]);
  }

  // Modificar cantidad de un producto
  const actualizarCantidad = (productoId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const nueva = Math.max(1, item.cantidad + delta);
            return { ...item, cantidad: nueva };
          }
          return item;
        })
        .filter((item) => item.cantidad > 0)
    );
  };

  const setCantidadDirecta = (productoId: string, cantidad: number) => {
    const cantValida = Math.max(1, isNaN(cantidad) ? 1 : cantidad);
    setItems((prev) =>
      prev.map((item) =>
        item.producto.id === productoId ? { ...item, cantidad: cantValida } : item
      )
    );
  };

  const eliminarItem = (productoId: string) => {
    setItems((prev) => prev.filter((item) => item.producto.id !== productoId));
  };

  const agregarProducto = (productoId: string) => {
    const prod = productosDisponibles.find((p) => p.id === productoId);
    if (!prod) return;
    setItems((prev) => {
      const existe = prev.find((item) => item.producto.id === productoId);
      if (existe) {
        return prev.map((item) =>
          item.producto.id === productoId ? { ...item, cantidad: item.cantidad + 3 } : item
        );
      }
      return [...prev, { producto: prod, cantidad: 3 }];
    });
    setProductoAAgregarId("");
  };

  // Expandir la lista de etiquetas individuales considerando la columna inicial
  const celdasParaImpresion = useMemo(() => {
    const lista: (Producto | null)[] = [];

    // Rellenar espacios vacíos si la columna inicial no es la 1
    if (columnaInicial > 1) {
      for (let i = 1; i < columnaInicial; i++) {
        lista.push(null); // Espacio en blanco
      }
    }

    // Agregar cada producto según su cantidad
    items.forEach((item) => {
      for (let i = 0; i < item.cantidad; i++) {
        lista.push(item.producto);
      }
    });

    // Completar con vacíos para que la última fila termine en múltiplo de 3
    const resto = lista.length % 3;
    if (resto !== 0) {
      const faltantes = 3 - resto;
      for (let i = 0; i < faltantes; i++) {
        lista.push(null);
      }
    }

    // Agrupar en filas de 3
    const filas: (Producto | null)[][] = [];
    for (let i = 0; i < lista.length; i += 3) {
      filas.push(lista.slice(i, i + 3));
    }

    return { listaPlana: lista, filas };
  }, [items, columnaInicial]);

  const totalEtiquetasReales = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.cantidad, 0);
  }, [items]);

  // Generar y descargar PDF calibrado (102mm ancho x 25mm alto por fila)
  const generarPDF = () => {
    if (totalEtiquetasReales === 0) {
      toast.error("Selecciona al menos un producto para imprimir");
      return;
    }

    try {
      // 102 mm ancho x 25 mm alto en orientación horizontal (landscape)
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [25, 102],
      });

      const anchoEtiqueta = 32; // mm
      const altoEtiqueta = 25; // mm
      const gapHorizontal = 2; // mm
      const margenIzquierdo = 1; // mm

      celdasParaImpresion.filas.forEach((fila, filaIdx) => {
        if (filaIdx > 0) {
          doc.addPage([25, 102], "landscape");
        }

        fila.forEach((producto, colIdx) => {
          if (!producto) return; // Etiqueta en blanco

          const x = margenIzquierdo + colIdx * (anchoEtiqueta + gapHorizontal);
          const centroX = x + anchoEtiqueta / 2;

          let currentY = 3.5;

          // 1. Nombre de la empresa (opcional)
          if (mostrarNombreNegocio) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5);
            doc.setTextColor(80, 80, 80);
            doc.text("MERCACRÉDITO", centroX, currentY, { align: "center" });
            currentY += 2.5;
          }

          // 2. Nombre del producto (dividido en líneas si es largo)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(0, 0, 0);

          const nombreLineas = doc.splitTextToSize(producto.nombre.toUpperCase(), anchoEtiqueta - 3);
          const lineasAMostrar = nombreLineas.slice(0, 2);
          doc.text(lineasAMostrar, centroX, currentY, { align: "center" });
          currentY += lineasAMostrar.length * 2.8 + 1;

          // 3. Precios según estilo seleccionado
          if (estiloPrecio === "solo_contado") {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(5);
            doc.text("PRECIO CONTADO", centroX, currentY, { align: "center" });
            currentY += 3.2;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text(formatearMoneda(producto.precio_contado), centroX, currentY, { align: "center" });
            currentY += 4;
          } else if (estiloPrecio === "solo_credito") {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(5);
            doc.text("PRECIO CRÉDITO", centroX, currentY, { align: "center" });
            currentY += 3.2;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text(formatearMoneda(producto.precio_credito), centroX, currentY, { align: "center" });
            currentY += 4;
          } else {
            // Ambos precios (Contado y Crédito)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.text(`CONT: ${formatearMoneda(producto.precio_contado)}`, centroX, currentY, { align: "center" });
            currentY += 3.2;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.text(`CRED: ${formatearMoneda(producto.precio_credito)}`, centroX, currentY, { align: "center" });
            currentY += 3.2;
          }

          // 4. Código del producto (opcional)
          if (mostrarCodigo && producto.codigo_producto) {
            doc.setFont("courier", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(60, 60, 60);
            doc.text(`COD: ${producto.codigo_producto}`, centroX, currentY, { align: "center" });
          }
        });
      });

      doc.save(`Etiquetas_Mercacredito_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF de etiquetas generado correctamente");
    } catch (err: any) {
      console.error("Error al generar PDF de etiquetas:", err);
      toast.error("Ocurrió un error al generar las etiquetas");
    }
  };

  // Impresión directa del navegador
  const imprimirNativo = () => {
    if (totalEtiquetasReales === 0) {
      toast.error("Selecciona al menos un producto para imprimir");
      return;
    }
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-background">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2 text-primary">
            <Tag className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold">
              Imprimir Etiquetas de Productos (SAT 32x25 mm)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Formato: <strong>Rollo de 3 Columnas (3 al paso)</strong> • Compatible con impresora{" "}
            <strong>NEW PRINT TT462B+ / SAT TT</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* PANEL IZQUIERDO: CONFIGURACIÓN Y PRODUCTOS (5 COLUMNAS) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Agregar Producto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Agregar Producto al Lote
              </Label>
              <Select
                value={productoAAgregarId}
                onValueChange={(val) => agregarProducto(val)}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Seleccionar producto para añadir..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {productosDisponibles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.nombre} ({p.codigo_producto})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de productos seleccionados */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Productos a Imprimir ({items.length})</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Total etiquetas: <strong>{totalEtiquetasReales}</strong>
                </span>
              </Label>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground italic">
                    No has agregado ningún producto. Selecciona uno arriba.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.producto.id}
                      className="border rounded-lg p-2.5 bg-muted/20 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate">
                          {item.producto.nombre}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.producto.codigo_producto} • Contado:{" "}
                          {formatearMoneda(item.producto.precio_contado)}
                        </p>
                      </div>

                      {/* Control de cantidad */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => actualizarCantidad(item.producto.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          className="h-7 w-12 text-center text-xs p-1 font-bold"
                          value={item.cantidad}
                          onChange={(e) =>
                            setCantidadDirecta(item.producto.id, parseInt(e.target.value) || 1)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => actualizarCantidad(item.producto.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => eliminarItem(item.producto.id)}
                          title="Quitar"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ajustes del diseño de etiqueta */}
            <div className="border rounded-xl p-3.5 bg-muted/10 space-y-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
                <span>Opciones de Diseño</span>
              </div>

              {/* Estilo de Precios */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Precios a Mostrar
                </Label>
                <Select
                  value={estiloPrecio}
                  onValueChange={(val: EstiloPrecio) => setEstiloPrecio(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos" className="text-xs">
                      Ambos (Contado y Crédito)
                    </SelectItem>
                    <SelectItem value="solo_contado" className="text-xs">
                      Solo Contado (Precio Grande)
                    </SelectItem>
                    <SelectItem value="solo_credito" className="text-xs">
                      Solo Crédito (Precio Grande)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Columna Inicial */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-semibold text-muted-foreground">
                    Empezar en Columna
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    (Si ya gastaste parte de la fila)
                  </span>
                </div>
                <Select
                  value={columnaInicial.toString()}
                  onValueChange={(val) => setColumnaInicial(parseInt(val))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">
                      Columna 1 (Izquierda - Fila Nueva)
                    </SelectItem>
                    <SelectItem value="2" className="text-xs">
                      Columna 2 (Centro)
                    </SelectItem>
                    <SelectItem value="3" className="text-xs">
                      Columna 3 (Derecha)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-negocio" className="text-[11px] cursor-pointer">
                    Encabezado "MERCACRÉDITO"
                  </Label>
                  <Switch
                    id="toggle-negocio"
                    checked={mostrarNombreNegocio}
                    onCheckedChange={setMostrarNombreNegocio}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-codigo" className="text-[11px] cursor-pointer">
                    Código del Producto (COD)
                  </Label>
                  <Switch
                    id="toggle-codigo"
                    checked={mostrarCodigo}
                    onCheckedChange={setMostrarCodigo}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: PREVISUALIZACIÓN REALISTA DEL ROLLO (7 COLUMNAS) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>Previsualización del Rollo (3 al paso)</span>
              </Label>
              <Badge variant="outline" className="text-[11px] font-mono">
                {celdasParaImpresion.filas.length} fila(s) • {totalEtiquetasReales} etiqueta(s)
              </Badge>
            </div>

            {/* Contenedor del rollo físico visual */}
            <div className="border rounded-xl p-4 bg-slate-100 dark:bg-slate-950 max-h-[380px] overflow-y-auto shadow-inner flex flex-col items-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-3">
                ▼ Sentido de Salida de la Impresora ▼
              </p>

              {celdasParaImpresion.filas.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground italic">
                  Agrega productos para visualizar cómo saldrán en el papel.
                </div>
              ) : (
                <div className="space-y-2.5 w-full max-w-[480px]">
                  {celdasParaImpresion.filas.map((fila, filaIdx) => (
                    <div
                      key={filaIdx}
                      className="grid grid-cols-3 gap-2 bg-white/70 dark:bg-slate-900/70 p-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-800"
                    >
                      {fila.map((producto, colIdx) => {
                        if (!producto) {
                          return (
                            <div
                              key={colIdx}
                              className="aspect-[32/25] rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-center"
                            >
                              <span className="text-[10px] text-slate-300 dark:text-slate-700 italic">
                                Vacío
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={colIdx}
                            className="aspect-[32/25] rounded-md bg-white text-black p-1.5 shadow-xs border border-slate-300 flex flex-col justify-between text-center select-none"
                          >
                            {/* Nombre del negocio */}
                            {mostrarNombreNegocio && (
                              <p className="text-[6.5px] font-extrabold uppercase tracking-widest text-slate-500 leading-tight">
                                MERCACRÉDITO
                              </p>
                            )}

                            {/* Nombre del producto */}
                            <p className="text-[8px] font-extrabold uppercase leading-tight line-clamp-2 text-slate-900">
                              {producto.nombre}
                            </p>

                            {/* Precios */}
                            <div className="my-0.5">
                              {estiloPrecio === "solo_contado" && (
                                <div>
                                  <span className="text-[6px] text-slate-500 font-bold block uppercase leading-none">
                                    Contado
                                  </span>
                                  <span className="text-[12px] font-black text-slate-950 leading-none tracking-tight">
                                    {formatearMoneda(producto.precio_contado)}
                                  </span>
                                </div>
                              )}
                              {estiloPrecio === "solo_credito" && (
                                <div>
                                  <span className="text-[6px] text-slate-500 font-bold block uppercase leading-none">
                                    Crédito
                                  </span>
                                  <span className="text-[12px] font-black text-slate-950 leading-none tracking-tight">
                                    {formatearMoneda(producto.precio_credito)}
                                  </span>
                                </div>
                              )}
                              {estiloPrecio === "ambos" && (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between items-center text-[7.5px] font-black leading-tight border-b border-slate-200 pb-0.5">
                                    <span className="text-[6.5px] text-slate-600 font-bold">CONT:</span>
                                    <span>{formatearMoneda(producto.precio_contado)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[7.5px] font-black leading-tight">
                                    <span className="text-[6.5px] text-slate-600 font-bold">CRED:</span>
                                    <span>{formatearMoneda(producto.precio_credito)}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Código del producto */}
                            {mostrarCodigo && (
                              <p className="text-[7px] font-mono font-bold text-slate-700 leading-tight">
                                COD: {producto.codigo_producto}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <p>
                  <strong>Consejo para la NEW PRINT TT462B+:</strong> En las preferencias de
                  impresión de Windows, configura el tamaño de papel como{" "}
                  <strong>102 mm × 25 mm</strong> (o 3 columnas de 32×25 mm). El sensor de brecha
                  (GAP) detectará cada fila con precisión milimétrica.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 flex flex-col sm:flex-row justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={generarPDF}
              disabled={totalEtiquetasReales === 0}
              className="text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 font-semibold"
            >
              <FileDown className="h-4 w-4" />
              Descargar PDF Térmico
            </Button>
            <Button
              type="button"
              onClick={imprimirNativo}
              disabled={totalEtiquetasReales === 0}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Imprimir Ahora ({totalEtiquetasReales})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* ESTILOS DE IMPRESIÓN DIRECTA NATIVA (@media print) */}
      <style>{`
        @media print {
          @page {
            size: 102mm 25mm;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #print-area-etiquetas, #print-area-etiquetas * {
            visibility: visible;
          }
          #print-area-etiquetas {
            position: absolute;
            left: 0;
            top: 0;
            width: 102mm;
            margin: 0;
            padding: 0;
          }
          .pagina-fila-etiquetas {
            width: 102mm;
            height: 25mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            page-break-after: always;
            box-sizing: border-box;
            padding: 0 1mm;
          }
          .etiqueta-celda-print {
            width: 32mm;
            height: 24mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            padding: 1.5mm;
            color: #000;
          }
        }
      `}</style>

      {/* ELEMENTO OCULTO PARA IMPRESIÓN NATIVA */}
      <div id="print-area-etiquetas" className="hidden">
        {celdasParaImpresion.filas.map((fila, fIdx) => (
          <div key={fIdx} className="pagina-fila-etiquetas">
            {fila.map((producto, cIdx) => {
              if (!producto) {
                return <div key={cIdx} className="etiqueta-celda-print" />;
              }

              return (
                <div key={cIdx} className="etiqueta-celda-print">
                  {mostrarNombreNegocio && (
                    <div style={{ fontSize: "5pt", fontWeight: "bold", color: "#555" }}>
                      MERCACRÉDITO
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "6.5pt",
                      fontWeight: "bold",
                      lineHeight: "1.1",
                      maxHeight: "6mm",
                      overflow: "hidden",
                    }}
                  >
                    {producto.nombre.toUpperCase()}
                  </div>

                  {estiloPrecio === "solo_contado" && (
                    <div style={{ fontSize: "10pt", fontWeight: "bold" }}>
                      {formatearMoneda(producto.precio_contado)}
                    </div>
                  )}
                  {estiloPrecio === "solo_credito" && (
                    <div style={{ fontSize: "10pt", fontWeight: "bold" }}>
                      {formatearMoneda(producto.precio_credito)}
                    </div>
                  )}
                  {estiloPrecio === "ambos" && (
                    <div style={{ fontSize: "6.5pt", fontWeight: "bold", lineHeight: "1.15" }}>
                      <div>CONT: {formatearMoneda(producto.precio_contado)}</div>
                      <div>CRED: {formatearMoneda(producto.precio_credito)}</div>
                    </div>
                  )}

                  {mostrarCodigo && (
                    <div style={{ fontSize: "5.5pt", fontFamily: "monospace", fontWeight: "bold" }}>
                      COD: {producto.codigo_producto}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
