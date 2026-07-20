import { useState, useEffect } from "react";
import { WifiOff, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineFallback() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state after mount (client-side only)
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
        Sin conexión a internet
      </h1>
      <p className="mb-8 max-w-sm text-muted-foreground">
        Parece que has perdido la señal. Por favor, verifica tu conexión a internet para poder sincronizar tus cobros y continuar operando.
      </p>
      <Button 
        onClick={() => window.location.reload()} 
        className="gap-2"
        size="lg"
      >
        <RefreshCcw className="h-4 w-4" />
        Reintentar conexión
      </Button>
    </div>
  );
}
