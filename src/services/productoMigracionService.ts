import { supabase } from "@/lib/supabase";

export interface FilaProductoExcel {
  "Id"?: string;
  "Nombre Artículo"?: string;
  "Categoría"?: string;
  "Precio de Compra"?: string | number;
  "Precio de Venta"?: string | number;
  "Cantidad en Stock"?: string | number;
  "Porcentaje"?: string | number;
}

/**
 * Lee un array de objetos parseados desde Excel y realiza la inserción masiva en Supabase.
 */
function getFlexibleValue(row: any, possibleNames: string[]): any {
  const keys = Object.keys(row);
  for (const key of keys) {
    const normalized = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "");
    for (const p of possibleNames) {
      if (normalized === p || normalized.includes(p)) {
        return row[key];
      }
    }
  }
  return undefined;
}

function parseNumberRobust(val: any, isPercentage: boolean = false): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  
  let str = val.toString().trim();
  str = str.replace(/[^0-9.,-]/g, ''); // Deja digitos, punto, coma y menos
  
  if (isPercentage) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      str = str.replace(/,/g, '');
    } else {
      if (lastComma !== -1) str = str.replace(/,/g, '.');
    }
  } else {
    // Si NO es porcentaje, es un precio o stock. En COP, no se usan centavos.
    // Ej: "65.000", "65,000", "65.000,00"
    // Primero, si termina en ,00 o .00 lo quitamos
    str = str.replace(/[,.]00$/, '');
    // Luego, quitamos todos los puntos y comas que quedan (separadores de miles)
    str = str.replace(/[,.]/g, '');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export async function importarProductosMasivo(filas: any[]): Promise<{ exito: number; errores: string[] }> {
  const errores: string[] = [];
  const productosAInsertar: any[] = [];

  for (let i = 0; i < filas.length; i++) {
    const row = filas[i];
    
    const codigoRaw = getFlexibleValue(row, ["id", "codigo"]);
    const nombreRaw = getFlexibleValue(row, ["nombre", "articulo"]);
    
    const codigo = codigoRaw?.toString().trim();
    const nombre = nombreRaw?.toString().trim();
    
    if (!codigo || !nombre) {
      errores.push(`Fila ${i + 2}: El código (Id) y el Nombre son obligatorios.`);
      continue;
    }

    const categoria = getFlexibleValue(row, ["categoria"])?.toString().trim() || null;
    
    const precioCompraRaw = getFlexibleValue(row, ["compra"]);
    const precioCompra = Math.max(0, parseNumberRobust(precioCompraRaw));

    const precioVentaRaw = getFlexibleValue(row, ["venta"]);
    const precioVenta = Math.max(0, parseNumberRobust(precioVentaRaw));

    const stockRaw = getFlexibleValue(row, ["stock", "cantidad"]);
    const stock = Math.max(0, parseNumberRobust(stockRaw));

    const porcentajeRaw = getFlexibleValue(row, ["porcentaje"]);
    const p = Math.max(0, parseNumberRobust(porcentajeRaw, true));
    
    const factorPorcentaje = p >= 1 ? p / 100 : p;
    const precioCredito = precioVenta + (precioVenta * factorPorcentaje);

    productosAInsertar.push({
      codigo_producto: codigo.toUpperCase(),
      nombre,
      categoria,
      precio_compra: precioCompra,
      precio_contado: precioVenta,
      precio_credito: Math.round(precioCredito),
      stock_disponible: stock,
      estado: "Activo"
    });
  }

  if (productosAInsertar.length === 0) {
    return { exito: 0, errores: ["No se encontraron productos válidos para importar."] };
  }

  // Inserción en lote (Batch Insert)
  // Utilizamos upsert = false por defecto. Si el código de producto (UNIQUE) ya existe, arrojará error.
  const { error } = await supabase
    .from("productos")
    .insert(productosAInsertar);

  if (error) {
    console.error("Error en migración de productos:", error);
    
    // Manejar errores comunes de Postgres (ej. 23505 = Unique Violation)
    if (error.code === "23505") {
      errores.push("Error: Algunos de los Códigos de Producto (Id) ya existen en la base de datos o están duplicados en el Excel.");
    } else {
      errores.push(`Error de base de datos: ${error.message}`);
    }
    return { exito: 0, errores };
  }

  return { exito: productosAInsertar.length, errores };
}
