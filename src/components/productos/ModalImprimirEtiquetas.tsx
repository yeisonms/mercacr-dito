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
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
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

  // Calibración milimétrica (recuerda ajustes del usuario en localStorage)
  const [offsetY, setOffsetY] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("mercacredito_etiquetas_offsetY");
    return saved !== null ? parseFloat(saved) : 0; // mm (+ = baja, - = sube)
  });

  const [offsetX, setOffsetX] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("mercacredito_etiquetas_offsetX");
    return saved !== null ? parseFloat(saved) : 0; // mm (+ = derecha, - = izquierda)
  });

  const [gapColumnas, setGapColumnas] = useState<number>(() => {
    if (typeof window === "undefined") return 2.5;
    const saved = localStorage.getItem("mercacredito_etiquetas_gap");
    return saved !== null ? parseFloat(saved) : 2.5; // mm (estándar SAT 3COL)
  });

  const [mostrarAjustesAvanzados, setMostrarAjustesAvanzados] = useState<boolean>(false);

  const guardarCalibracion = (y: number, x: number, gap: number) => {
    setOffsetY(y);
    setOffsetX(x);
    setGapColumnas(gap);
    if (typeof window !== "undefined") {
      localStorage.setItem("mercacredito_etiquetas_offsetY", y.toString());
      localStorage.setItem("mercacredito_etiquetas_offsetX", x.toString());
      localStorage.setItem("mercacredito_etiquetas_gap", gap.toString());
    }
  };

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

  // Construir PDF calibrado en memoria (102mm ancho x 25mm alto por fila)
  const construirDocPDF = (): jsPDF | null => {
    if (totalEtiquetasReales === 0) {
      toast.error("Selecciona al menos un producto para imprimir");
      return null;
    }

    try {
      // 102 mm ancho x 25 mm alto en orientación horizontal (landscape)
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [25, 102],
      });

      const anchoEtiqueta = 32; // mm
      const margenIzquierdo = Math.max(0, 2.2 + offsetX); // mm (calibrado para SAT 3COL)
      const gapHorizontal = Math.max(1, gapColumnas); // mm (por defecto 2.5 mm)

      celdasParaImpresion.filas.forEach((fila, filaIdx) => {
        if (filaIdx > 0) {
          doc.addPage([25, 102], "landscape");
        }

        fila.forEach((producto, colIdx) => {
          if (!producto) return; // Etiqueta en blanco (vacía)

          const x = margenIzquierdo + colIdx * (anchoEtiqueta + gapHorizontal);
          const centroX = x + anchoEtiqueta / 2;

          // Punto de inicio vertical compacto (permite que todo el contenido entre con margen de sobra)
          let currentY = Math.max(1.0, 2.0 + offsetY);

          // 1. Nombre de la empresa (opcional)
          if (mostrarNombreNegocio) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(4.8);
            doc.setTextColor(70, 70, 70);
            doc.text("MERCACRÉDITO", centroX, currentY, { align: "center" });
            currentY += 2.2;
          }

          // 2. Nombre del producto (dividido en máximo 2 líneas compactas)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.2);
          doc.setTextColor(0, 0, 0);

          const nombreLineas = doc.splitTextToSize(producto.nombre.toUpperCase(), anchoEtiqueta - 3);
          const lineasAMostrar = nombreLineas.slice(0, 2);
          doc.text(lineasAMostrar, centroX, currentY, { align: "center" });
          currentY += lineasAMostrar.length * 2.4 + 0.6;

          // 3. Precios según estilo seleccionado
          if (estiloPrecio === "solo_contado") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(4.5);
            doc.setTextColor(80, 80, 80);
            doc.text("PRECIO CONTADO", centroX, currentY, { align: "center" });
            currentY += 2.6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(0, 0, 0);
            doc.text(formatearMoneda(producto.precio_contado), centroX, currentY, { align: "center" });
            currentY += 3.2;
          } else if (estiloPrecio === "solo_credito") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(4.5);
            doc.setTextColor(80, 80, 80);
            doc.text("PRECIO CRÉDITO", centroX, currentY, { align: "center" });
            currentY += 2.6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(0, 0, 0);
            doc.text(formatearMoneda(producto.precio_credito), centroX, currentY, { align: "center" });
            currentY += 3.2;
          } else {
            // Ambos precios (Contado y Crédito)
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.15);
            doc.line(x + 2, currentY - 0.3, x + anchoEtiqueta - 2, currentY - 0.3);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.6);
            doc.setTextColor(0, 0, 0);
            doc.text(`CONT: ${formatearMoneda(producto.precio_contado)}`, centroX, currentY + 1.8, { align: "center" });
            currentY += 2.6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.6);
            doc.setTextColor(0, 0, 0);
            doc.text(`CRED: ${formatearMoneda(producto.precio_credito)}`, centroX, currentY + 1.8, { align: "center" });
            currentY += 2.6;
          }

          // 4. Código del producto (opcional)
          if (mostrarCodigo && producto.codigo_producto) {
            doc.setFont("courier", "bold");
            doc.setFontSize(5.8);
            doc.setTextColor(30, 30, 30);
            doc.text(`COD: ${producto.codigo_producto}`, centroX, currentY + 1.2, { align: "center" });
          }
        });
      });

      return doc;
    } catch (err: any) {
      console.error("Error al construir PDF de etiquetas:", err);
      toast.error("Ocurrió un error al generar las etiquetas");
      return null;
    }
  };

  // Descargar archivo .pdf
  const descargarPDF = () => {
    const doc = construirDocPDF();
    if (!doc) return;
    doc.save(`Etiquetas_Mercacredito_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF de etiquetas descargado");
  };

  // Abrir PDF en nueva pestaña mediante embed para evitar bloqueo de navegación blob en Chromium
  const abrirPDF = () => {
    const doc = construirDocPDF();
    if (!doc) return;
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    const win = window.open("", "_blank");
    if (!win) {
      doc.save(`Etiquetas_Mercacredito_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.info("Ventana emergente bloqueada; se descargó el PDF directamente");
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas Mercacrédito - PDF</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background-color: #2b2b2b;
            }
            embed {
              width: 100%;
              height: 100%;
              border: none;
            }
          </style>
        </head>
        <body>
          <embed src="${blobUrl}" type="application/pdf" />
        </body>
      </html>
    `);
    win.document.close();
    toast.success("PDF abierto en visor. Puedes imprimir con el icono de la impresora o Ctrl+P");
  };

  // Generar HTML puro para la ventana de impresión en iframe aislado
  const generarHTMLImpresion = (): string => {
    const margenIzqTotal = Math.max(0, 2.2 + offsetX);
    const gapCol = Math.max(1, gapColumnas);
    const paddingTop = Math.max(0.5, 1.2 + offsetY);

    const filasHTML = celdasParaImpresion.filas
      .map((fila) => {
        const celdasHTML = fila
          .map((producto) => {
            if (!producto) {
              return `<div class="celda-etiqueta celda-vacia"></div>`;
            }

            const negocioHTML = mostrarNombreNegocio
              ? `<div class="marca-negocio">MERCACRÉDITO</div>`
              : "";

            const nombreHTML = `<div class="nombre-producto">${producto.nombre.toUpperCase()}</div>`;

            let preciosHTML = "";
            if (estiloPrecio === "solo_contado") {
              preciosHTML = `
                <div class="bloque-precio-unico">
                  <span class="precio-tipo-tag">CONTADO</span>
                  <span class="precio-valor-grande">${formatearMoneda(producto.precio_contado)}</span>
                </div>
              `;
            } else if (estiloPrecio === "solo_credito") {
              preciosHTML = `
                <div class="bloque-precio-unico">
                  <span class="precio-tipo-tag">CRÉDITO</span>
                  <span class="precio-valor-grande">${formatearMoneda(producto.precio_credito)}</span>
                </div>
              `;
            } else {
              preciosHTML = `
                <div class="bloque-precios-ambos">
                  <div class="fila-precio-ambos">
                    <span class="precio-label">CONT:</span>
                    <span>${formatearMoneda(producto.precio_contado)}</span>
                  </div>
                  <div class="fila-precio-ambos">
                    <span class="precio-label">CRED:</span>
                    <span>${formatearMoneda(producto.precio_credito)}</span>
                  </div>
                </div>
              `;
            }

            const codigoHTML =
              mostrarCodigo && producto.codigo_producto
                ? `<div class="codigo-producto">COD: ${producto.codigo_producto}</div>`
                : "";

            return `
              <div class="celda-etiqueta">
                ${negocioHTML}
                ${nombreHTML}
                ${preciosHTML}
                ${codigoHTML}
              </div>
            `;
          })
          .join("");

        return `<div class="fila-etiquetas">${celdasHTML}</div>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiquetas Mercacrédito</title>
  <style>
    @page {
      size: 102mm 25mm;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 102mm;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
    }
    .fila-etiquetas {
      width: 102mm;
      height: 25mm;
      max-height: 25mm;
      display: flex;
      flex-direction: row;
      align-items: center;
      page-break-after: always;
      break-after: page;
      padding-left: ${margenIzqTotal.toFixed(1)}mm;
      gap: ${gapCol.toFixed(1)}mm;
      overflow: hidden;
      box-sizing: border-box;
    }
    .celda-etiqueta {
      width: 32mm;
      height: 24mm;
      max-height: 24mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      padding-top: ${paddingTop.toFixed(1)}mm;
      padding-bottom: 0.5mm;
      padding-left: 1mm;
      padding-right: 1mm;
      overflow: hidden;
      box-sizing: border-box;
    }
    .celda-vacia {
      visibility: hidden;
    }
    .marca-negocio {
      font-size: 4.8pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #333333;
      text-transform: uppercase;
      line-height: 1;
      margin-bottom: 0.6mm;
    }
    .nombre-producto {
      font-size: 6.2pt;
      font-weight: 900;
      line-height: 1.1;
      color: #000000;
      text-transform: uppercase;
      max-height: 5.6mm;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
      margin-bottom: 0.6mm;
    }
    .bloque-precios-ambos {
      width: 100%;
      border-top: 0.5px solid #666;
      padding-top: 0.5mm;
      display: flex;
      flex-direction: column;
      gap: 0.2mm;
      margin-bottom: 0.6mm;
    }
    .fila-precio-ambos {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      width: 100%;
      font-size: 6.5pt;
      font-weight: 900;
      color: #000000;
      line-height: 1;
    }
    .fila-precio-ambos .precio-label {
      font-size: 5.2pt;
      font-weight: 800;
      color: #333333;
    }
    .bloque-precio-unico {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      margin-bottom: 0.6mm;
    }
    .bloque-precio-unico .precio-tipo-tag {
      font-size: 4.5pt;
      font-weight: 800;
      color: #444444;
      text-transform: uppercase;
      margin-bottom: 0.2mm;
    }
    .bloque-precio-unico .precio-valor-grande {
      font-size: 10.5pt;
      font-weight: 900;
      color: #000000;
      letter-spacing: -0.2px;
    }
    .codigo-producto {
      font-size: 5.5pt;
      font-family: "Courier New", Courier, monospace;
      font-weight: 900;
      color: #222222;
      line-height: 1;
    }
  </style>
</head>
<body>
  ${filasHTML}
</body>
</html>`;
  };

  // Impresión directa del navegador a través de un iframe aislado (100% visible para Chromium, pero off-screen)
  const imprimirNativo = () => {
    if (totalEtiquetasReales === 0) {
      toast.error("Selecciona al menos un producto para imprimir");
      return;
    }

    try {
      const htmlContent = generarHTMLImpresion();

      // Limpiar iframe previo si existía
      const framePrevio = document.getElementById("etiquetas-print-frame");
      if (framePrevio) {
        framePrevio.remove();
      }

      const iframe = document.createElement("iframe");
      iframe.id = "etiquetas-print-frame";
      iframe.style.position = "fixed";
      iframe.style.top = "0";
      iframe.style.left = "-10000px"; // Fuera del viewport pero totalmente renderizado por Chromium
      iframe.style.width = "102mm";
      iframe.style.height = "25mm";
      iframe.style.border = "none";
      iframe.style.zIndex = "-9999";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        toast.error("No se pudo iniciar el proceso de impresión");
        return;
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Error al disparar print en iframe:", e);
          toast.error("Error al abrir la ventana de impresión");
        }
      }, 350);
    } catch (err) {
      console.error("Error en imprimirNativo:", err);
      toast.error("Error al preparar la impresión");
    }
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

              {/* Calibración Fina de la Impresora */}
              <div className="pt-2 border-t border-border/50 space-y-2">
                <button
                  type="button"
                  onClick={() => setMostrarAjustesAvanzados(!mostrarAjustesAvanzados)}
                  className="flex items-center justify-between w-full text-[11px] font-semibold text-primary hover:underline py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Calibración y Márgenes Físicos
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {mostrarAjustesAvanzados ? (
                      <>
                        Ocultar <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        Ajustar milímetros <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </span>
                </button>

                {mostrarAjustesAvanzados && (
                  <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60 space-y-2.5">
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Ajusta si la impresión sale desplazada o recortada respecto a tus etiquetas adhesivas:
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] font-bold text-foreground block mb-0.5">
                          Vertical (Y)
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            value={offsetY}
                            onChange={(e) =>
                              guardarCalibracion(parseFloat(e.target.value) || 0, offsetX, gapColumnas)
                            }
                            className="h-7 text-xs text-center p-1 bg-background"
                          />
                          <span className="text-[10px] text-muted-foreground">mm</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">(- sube, + baja)</span>
                      </div>

                      <div>
                        <Label className="text-[10px] font-bold text-foreground block mb-0.5">
                          Horizontal (X)
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            value={offsetX}
                            onChange={(e) =>
                              guardarCalibracion(offsetY, parseFloat(e.target.value) || 0, gapColumnas)
                            }
                            className="h-7 text-xs text-center p-1 bg-background"
                          />
                          <span className="text-[10px] text-muted-foreground">mm</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">(- izq, + der)</span>
                      </div>

                      <div>
                        <Label className="text-[10px] font-bold text-foreground block mb-0.5">
                          Gap Columnas
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.2"
                            value={gapColumnas}
                            onChange={(e) =>
                              guardarCalibracion(offsetY, offsetX, parseFloat(e.target.value) || 2.5)
                            }
                            className="h-7 text-xs text-center p-1 bg-background"
                          />
                          <span className="text-[10px] text-muted-foreground">mm</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">(SAT: 2.5)</span>
                      </div>
                    </div>
                  </div>
                )}
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
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground font-mono">
                    <span>Col 1 (Izquierda)</span>
                    <span>Col 2 (Centro)</span>
                    <span>Col 3 (Derecha)</span>
                  </div>
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

            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Configuración en Adobe Acrobat Reader (Impresión Perfecta):</span>
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground list-disc list-inside leading-relaxed pl-1">
                <li>
                  <strong>Orientación:</strong> Selecciona <strong>"Vertical"</strong> (o "Automática vertical/horizontal"). ⚠️ <em>Nunca selecciones "Horizontal" manual, ya que el archivo ya es horizontal y Adobe lo giraría de cabeza.</em>
                </li>
                <li>
                  <strong>Tamaño y escala:</strong> Selecciona <strong>"Tamaño real"</strong> (100%).
                </li>
                <li>
                  <strong>Origen del papel:</strong> Si aparece la casilla <em>"Elegir origen del papel por tamaño de página PDF"</em>, déjala marcada.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 flex flex-col sm:flex-row justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
            Cerrar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={abrirPDF}
              disabled={totalEtiquetasReales === 0}
              className="text-xs gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 font-semibold"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Visor PDF
            </Button>
            <Button
              type="button"
              onClick={descargarPDF}
              disabled={totalEtiquetasReales === 0}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
            >
              <FileDown className="h-4 w-4" />
              Descargar PDF Térmico ({totalEtiquetasReales} etiquetas)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

