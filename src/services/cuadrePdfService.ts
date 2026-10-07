import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { CobroHistorialRow } from "./cobrosHistorialService";
import { formatearMoneda } from "./producto.service";

export interface GenerarPdfCuadreParams {
  cobros: CobroHistorialRow[];
  rangoFechasTexto: string;
  cobradorTexto: string;
  busquedaTexto?: string;
  usuarioGenerador?: string;
  rolUsuario?: string;
  totalEfectivo: number;
  totalTransferencia: number;
  totalGeneral: number;
}

/**
 * Carga una imagen remota o local a Base64 para incluirla en el PDF
 */
async function cargarImagenBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Genera y descarga el PDF de Cuadre de Caja con la data filtrada
 */
export async function descargarPdfCuadreCaja(params: GenerarPdfCuadreParams): Promise<void> {
  const {
    cobros,
    rangoFechasTexto,
    cobradorTexto,
    busquedaTexto,
    usuarioGenerador = "Administrador",
    rolUsuario = "",
    totalEfectivo,
    totalTransferencia,
    totalGeneral,
  } = params;

  // Crear documento PDF en formato A4 vertical
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let currentY = 14;

  // 1. Cargar e insertar Logo si está disponible
  const logoBase64 = await cargarImagenBase64("/logo.jpeg");
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "JPEG", marginLeft, currentY, 20, 20);
    } catch {
      // Si falla la inserción de la imagen, continúa sin romper la ejecución
    }
  }

  // 2. Encabezado principal
  const headerTextX = logoBase64 ? marginLeft + 24 : marginLeft;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("MERCACRÉDITO", headerTextX, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("Cuadre de Caja — Historial de Recaudos", headerTextX, currentY + 12);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  const ahora = new Date();
  const fechaEmision = format(ahora, "dd/MM/yyyy hh:mm a", { locale: es });
  doc.text(`Emisión: ${fechaEmision}`, headerTextX, currentY + 17);

  // Metadatos de usuario a la derecha
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const infoUsuario = `Generado por: ${usuarioGenerador}${rolUsuario ? ` (${rolUsuario})` : ""}`;
  doc.text(infoUsuario, pageWidth - marginRight, currentY + 7, { align: "right" });

  currentY += 24;

  // 3. Tarjeta / Cuadro con los filtros aplicados
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(marginLeft, currentY, contentWidth, 20, 2, 2, "FD");

  doc.setFontSize(8.5);
  const col1X = marginLeft + 4;
  const col2X = marginLeft + (contentWidth / 2) + 2;

  // Fila 1 de filtros
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Rango de Fechas:", col1X, currentY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(rangoFechasTexto || "Hoy", col1X + 28, currentY + 6);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Cobrador:", col2X, currentY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(cobradorTexto || "Todos", col2X + 18, currentY + 6);

  // Fila 2 de filtros
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Buscador:", col1X, currentY + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(busquedaTexto ? `"${busquedaTexto}"` : "Ninguno", col1X + 28, currentY + 14);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Recaudos visibles:", col2X, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(`${cobros.length} recibo(s)`, col2X + 30, currentY + 14);

  currentY += 24;

  // 4. Preparar datos para la tabla
  const tableHead = [
    ["FECHA", "CLIENTE / CÉDULA", "FACTURA", "COBRADOR", "MÉTODO", "RECAUDO", "ESTADO"]
  ];

  const tableBody = cobros.map((cobro) => {
    let fechaStr = "";
    try {
      fechaStr = format(new Date(cobro.fechaRecaudo), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      fechaStr = cobro.fechaRecaudo;
    }

    const clienteTexto = `${cobro.clienteNombres} ${cobro.clienteApellidos}\nCC: ${cobro.clienteCedula}`;

    return [
      fechaStr,
      clienteTexto,
      cobro.numeroFactura || "-",
      cobro.cobradorNombre || "-",
      cobro.metodoPago,
      formatearMoneda(cobro.valorRecibido),
      cobro.estado,
    ];
  });

  // Si no hay cobros filtrados
  if (tableBody.length === 0) {
    tableBody.push([
      "-",
      "No hay recaudos para los filtros seleccionados",
      "-",
      "-",
      "-",
      formatearMoneda(0),
      "-"
    ]);
  }

  // 5. Renderizar tabla con autoTable
  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: "striped",
    margin: { left: marginLeft, right: marginRight, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [241, 245, 249],
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [67, 56, 202], // Indigo-700
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26 }, // Fecha
      1: { cellWidth: 48 }, // Cliente / Cédula
      2: { cellWidth: 22 }, // Factura
      3: { cellWidth: 28 }, // Cobrador
      4: { cellWidth: 22 }, // Método
      5: { cellWidth: 22, halign: "right", fontStyle: "bold" }, // Recaudo
      6: { cellWidth: 14, halign: "center" }, // Estado
    },
    didDrawCell: (data) => {
      // Color especial para el estado
      if (data.section === "body" && data.column.index === 6) {
        // Estado
      }
    },
    didDrawPage: (data) => {
      // Pie de página en cada página
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184); // slate-400
      
      const footerY = pageHeight - 8;
      doc.text(
        `Mercacrédito • Documento Oficial de Conciliación y Cuadre de Caja`,
        marginLeft,
        footerY
      );
      doc.text(
        `Página ${data.pageNumber} de ${pageNum}`,
        pageWidth - marginRight,
        footerY,
        { align: "right" }
      );
    },
  });

  // Ajustar número total de páginas en todas las hojas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - marginRight,
      pageHeight - 8,
      { align: "right" }
    );
  }

  // 6. Bloque de Totales al pie de la tabla
  // @ts-expect-error - jspdf-autotable extiende la instancia
  const finalY = doc.lastAutoTable?.finalY || currentY + 40;

  // Si no cabe el bloque de totales en la página actual (necesitamos ~32mm), agregar página
  let totalsY = finalY + 6;
  if (totalsY + 30 > pageHeight - 15) {
    doc.addPage();
    totalsY = 16;
  }

  // Tarjeta contenedora de totales
  doc.setFillColor(243, 244, 246); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(marginLeft, totalsY, contentWidth, 22, 2, 2, "FD");

  // Columna 1: Total Efectivo
  const summaryCol1 = marginLeft + 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Total Efectivo:", summaryCol1, totalsY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text(formatearMoneda(totalEfectivo), summaryCol1, totalsY + 16);

  // Columna 2: Total Transferencias
  const summaryCol2 = marginLeft + (contentWidth * 0.35);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Total Transferencias:", summaryCol2, totalsY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(126, 34, 206); // purple-700
  doc.text(formatearMoneda(totalTransferencia), summaryCol2, totalsY + 16);

  // Columna 3: TOTAL RECAUDADO (VISIBLE)
  const summaryCol3 = marginLeft + (contentWidth * 0.68);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text("TOTAL RECAUDADO (VISIBLE):", summaryCol3, totalsY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(formatearMoneda(totalGeneral), summaryCol3, totalsY + 16);

  // 7. Descargar el archivo
  const fechaNombre = format(ahora, "yyyy-MM-dd");
  const cobradorLimpio = cobradorTexto.replace(/[^a-zA-Z0-9]/g, "_");
  const nombreArchivo = `Cuadre_Caja_${cobradorLimpio}_${fechaNombre}.pdf`;

  doc.save(nombreArchivo);
}
