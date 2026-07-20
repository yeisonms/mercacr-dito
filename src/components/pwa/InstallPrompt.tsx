import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DownloadCloud, X } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevenir el mini-infobar predeterminado
      e.preventDefault();
      // Guardar el evento para poder dispararlo luego
      setDeferredPrompt(e);
      // Mostrar nuestra propia interfaz
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar el prompt nativo
    deferredPrompt.prompt();

    // Esperar la decisión del usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("El usuario aceptó la instalación de la PWA");
    } else {
      console.log("El usuario rechazó la instalación de la PWA");
    }

    // Ya no podemos usar el mismo prompt de nuevo
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-lg sm:left-auto sm:w-96 sm:right-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <DownloadCloud className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-card-foreground">App Disponible</p>
          <p className="text-xs text-muted-foreground">Instálala en tu dispositivo</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleInstallClick} className="px-3">
          Instalar
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
