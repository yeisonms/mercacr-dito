import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';

/**
 * Servicio para comprimir imágenes en el frontend antes de subirlas a Supabase.
 * Límites estrictos para no agotar el 1GB de la base de datos (Máximo 200 KB).
 */
export async function compressImage(file: File): Promise<File> {
  // Solo procesar si es una imagen
  if (!file.type.startsWith('image/')) {
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
    const compressedBlob = await imageCompression(file, options);
    
    // Cambiar la extensión a .webp
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
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
