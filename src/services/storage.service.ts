/**
 * storageService.ts
 * Servicio centralizado para subida de archivos a Supabase Storage.
 * Bucket: 'documentos_clientes'
 */
import { supabase } from "@/lib/supabase";
import { compressImage } from "./imageOptimizationService";

const BUCKET = "documentos_clientes";

/** Tipos permitidos de documento para un cliente */
export type TipoDocumento = "foto" | "cedula_frente" | "cedula_respaldo" | "foto_casa_1" | "foto_casa_2";

/** Resultado tipado de una subida */
export interface ResultadoSubida {
  tipo: TipoDocumento;
  url: string;
}

/**
 * Genera un nombre de archivo único para evitar colisiones.
 * Formato: {folderId}/{tipo}_{timestamp}_{nombre_original_sanitizado}.{ext}
 */
function generarRutaArchivo(
  folderId: string,
  tipo: TipoDocumento,
  file: File,
): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const nombreSanitizado = file.name
    .replace(/\.[^/.]+$/, "")               // sin extensión
    .replace(/[^a-zA-Z0-9_\-]/g, "_")       // solo alfanuméricos
    .slice(0, 30);                           // máximo 30 chars
  const timestamp = Date.now();
  return `${folderId}/${tipo}_${timestamp}_${nombreSanitizado}.${extension}`;
}

/**
 * Sube UN archivo al bucket 'documentos_clientes'.
 * Retorna la URL pública permanente.
 *
 * @throws Error con mensaje descriptivo si la subida falla
 */
export async function subirArchivo(
  folderId: string,
  tipo: TipoDocumento,
  originalFile: File,
): Promise<string> {
  // Comprimir imagen antes de subirla
  const file = await compressImage(originalFile);
  const ruta = generarRutaArchivo(folderId, tipo, file);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, {
      cacheControl: "3600",
      upsert: false,           // false = falla si ya existe (nombres únicos)
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir ${tipo}: ${uploadError.message}`,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

/**
 * Sube múltiples archivos en paralelo (Promise.all).
 * Si CUALQUIERA falla, lanza un error y detiene todo el proceso.
 * Retorna un mapa tipo → URL de solo los archivos que se pasaron.
 *
 * @param folderId Identificador único del cliente (ej. codigo_consecutivo) usado como carpeta
 * @param archivos Mapa con los archivos a subir (valores null son ignorados)
 */
export async function subirDocumentosCliente(
  folderId: string,
  archivos: Partial<Record<TipoDocumento, File | null>>,
): Promise<Partial<Record<TipoDocumento, string>>> {
  // Filtrar solo los archivos que realmente existen
  const entradas = (
    Object.entries(archivos) as [TipoDocumento, File | null][]
  ).filter((entry): entry is [TipoDocumento, File] => entry[1] !== null);

  if (entradas.length === 0) return {};

  // Subir todos en paralelo
  const resultados = await Promise.all(
    entradas.map(async ([tipo, file]) => {
      const url = await subirArchivo(folderId, tipo, file);
      return [tipo, url] as const;
    }),
  );

  return Object.fromEntries(resultados);
}
