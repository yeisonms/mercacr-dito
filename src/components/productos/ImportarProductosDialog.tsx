import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, UploadCloud, Loader2, FileSpreadsheet } from "lucide-react";
import { descargarPlantillaProductos } from "@/services/plantillaProductosService";
import { importarProductosMasivo, type FilaProductoExcel } from "@/services/productoMigracionService";

interface ImportarProductosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportarProductosDialog({ open, onOpenChange, onSuccess }: ImportarProductosDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<FilaProductoExcel[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reiniciar el estado cuando se abre/cierra
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewData([]);
      setIsProcessing(false);
    }
  }, [open]);

  const handleDownloadTemplate = () => {
    try {
      descargarPlantillaProductos();
      toast.success("Plantilla descargada. Llénala y súbela aquí.");
    } catch (error) {
      toast.error("Error al generar la plantilla.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        
        // Convertir a JSON
        const data = XLSX.utils.sheet_to_json<FilaProductoExcel>(ws);
        setPreviewData(data);
        
        if (data.length === 0) {
          toast.warning("El archivo Excel parece estar vacío.");
        }
      } catch (error) {
        console.error(error);
        toast.error("El archivo no tiene el formato Excel correcto.");
        setFile(null);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleConfirm = async () => {
    if (previewData.length === 0) {
      toast.error("No hay datos para importar.");
      return;
    }

    setIsProcessing(true);
    
    try {
      const { exito, errores } = await importarProductosMasivo(previewData);
      
      if (errores.length > 0) {
        // Mostrar el primer error o un resumen
        toast.error(errores[0]);
      }
      
      if (exito > 0) {
        toast.success(`Se han importado ${exito} productos correctamente.`);
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error("Ocurrió un error inesperado al procesar la migración.");
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            Importar Productos desde Excel
          </DialogTitle>
          <DialogDescription>
            Sube un archivo Excel para cargar tu inventario masivamente. Usa nuestra plantilla para asegurar el formato correcto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
          {/* Botón de plantilla */}
          <div className="flex justify-start">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Descargar Plantilla de Ejemplo
            </Button>
          </div>

          {/* Zona de Drop/Input */}
          {!file ? (
            <div 
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer"
              onClick={triggerFileInput}
            >
              <UploadCloud className="h-10 w-10 text-slate-400 mb-4" />
              <p className="text-sm font-medium text-slate-700">Haz clic para seleccionar tu archivo Excel</p>
              <p className="text-xs text-slate-500 mt-1">Formatos soportados: .xlsx, .xls</p>
              <Input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium truncate">{file.name}</span>
                <span className="text-xs text-slate-500 shrink-0">
                  ({previewData.length} filas detectadas)
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  setFile(null);
                  setPreviewData([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Cambiar
              </Button>
            </div>
          )}

          {/* Vista previa de la tabla */}
          {previewData.length > 0 && (
            <div className="flex-1 overflow-auto border rounded-md">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead>Id</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row["Id"]}</TableCell>
                      <TableCell>{row["Nombre Artículo"]}</TableCell>
                      <TableCell>{row["Categoría"] || "-"}</TableCell>
                      <TableCell className="text-right">{row["Precio de Venta"]}</TableCell>
                      <TableCell className="text-right">{row["Cantidad en Stock"]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewData.length > 5 && (
                <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t">
                  Mostrando 5 de {previewData.length} filas...
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!file || previewData.length === 0 || isProcessing}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              "Confirmar y Subir Productos"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
