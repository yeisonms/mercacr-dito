import * as XLSX from "xlsx";

/**
 * Genera y descarga la plantilla de Excel para la migración de productos.
 */
export function descargarPlantillaProductos() {
  const columnas = [
    "Id",
    "Nombre Artículo",
    "Categoría",
    "Precio de Compra",
    "Precio de Venta",
    "Cantidad en Stock",
    "Porcentaje",
  ];

  // Agregamos un par de filas de ejemplo para guiar al usuario
  const datosEjemplo = [
    {
      "Id": "PROD-001",
      "Nombre Artículo": "Televisor Samsung 55\"",
      "Categoría": "Electrodomésticos",
      "Precio de Compra": 1200000,
      "Precio de Venta": 1800000,
      "Cantidad en Stock": 10,
      "Porcentaje": 25, // 25% o 0.25
    },
    {
      "Id": "PROD-002",
      "Nombre Artículo": "Licuadora Oster",
      "Categoría": "Hogar",
      "Precio de Compra": 85000,
      "Precio de Venta": 130000,
      "Cantidad en Stock": 20,
      "Porcentaje": "0.30", // Puede venir como string decimal
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(datosEjemplo, { header: columnas });
  
  // Ajustar anchos de columna para mejor visualización
  const wscols = [
    { wch: 15 }, // Id
    { wch: 35 }, // Nombre Artículo
    { wch: 20 }, // Categoría
    { wch: 18 }, // Precio de Compra
    { wch: 18 }, // Precio de Venta
    { wch: 18 }, // Cantidad en Stock
    { wch: 15 }, // Porcentaje
  ];
  worksheet["!cols"] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Productos");

  XLSX.writeFile(workbook, "plantilla_migracion_productos.xlsx");
}
