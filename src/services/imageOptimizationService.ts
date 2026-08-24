import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';
import { toast } from 'sonner';

/**
 * Servicio para comprimir imágenes en el frontend antes de subirlas a Supabase.
 * Límites estrictos para no agotar el 1GB de la base de datos (Máximo 200 KB).
 */
export async function compressImage(file: File): Promise<File> {
  const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';

  // Solo procesar si es una imagen (HEIC a veces viene sin type o con image/heic)
  if (!file.type.startsWith('image/') && !isHeic) {
    return file;
  }

  const options = {
    maxSizeMB: 0.2, // 200 KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp', // Mayor compresión
  };

  const toastId = toast.loading("Optimizando imagen para ahorrar datos...");

  try {
    let fileToCompress = file;

    // 1. Si es HEIC (iPhone), convertir primero a JPEG
    if (isHeic) {
      toast.loading("Convirtiendo formato HEIC de iPhone...", { id: toastId });
      try {
        const converted = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8
        });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        fileToCompress = new File([blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      } catch (err) {
        console.error("No se pudo convertir HEIC, usando original", err);
      }
    }

    toast.loading("Comprimiendo imagen...", { id: toastId });
    // 2. Comprimir el archivo (original o convertido)
    const compressedBlob = await imageCompression(fileToCompress, options);
    
    // Cambiar la extensión a .webp
    const fileNameWithoutExt = fileToCompress.name.replace(/\.[^/.]+$/, "");
    const newFileName = `${fileNameWithoutExt}.webp`;
    
    const compressedFile = new File([compressedBlob], newFileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    toast.dismiss(toastId);
    return compressedFile;
  } catch (error) {
    console.error("Error comprimiendo imagen:", error);
    toast.error("Error optimizando la imagen. Se subirá el original.", { id: toastId });
    // Fallback: devolver el archivo original si falla
    return file;
  }
}
