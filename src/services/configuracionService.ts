/**
 * configuracionService.ts
 * Servicio para consultar y actualizar la configuración de mora y plantillas de negocio.
 * Tabla: configuracion_negocio (id, porcentaje_mora_mes_3, dias_gracia_mora, plantilla_recordatorio_antici, plantilla_mora_critica)
 * Registro único asumido: id = 1.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ConfiguracionNegocio {
  id: number;
  porcentaje_mora_mes_3: number;
  dias_gracia_mora: number;
  plantilla_recordatorio_antici: string;
  plantilla_mora_critica: string;
  ultima_actualizacion?: string;
}

const CONFIG_DEFECTO: ConfiguracionNegocio = {
  id: 1,
  porcentaje_mora_mes_3: 5.00,
  dias_gracia_mora: 2,
  plantilla_recordatorio_antici: "Hola, recuerda que mañana vence tu cuota con Mercacrédito.",
  plantilla_mora_critica: "Aviso urgente: Tu crédito presenta un atraso superior a 30 días.",
};

// Guardar en memoria local en desarrollo cuando Supabase no esté configurado
let cacheConfiguracionLocal = { ...CONFIG_DEFECTO };

/**
 * Consulta la configuración única del negocio (id = 1).
 * Si no está configurado Supabase, retorna los datos locales de desarrollo.
 * Si el registro id = 1 no existe en Supabase, lo inicializa con valores por defecto.
 */
export async function obtenerConfiguracion(): Promise<ConfiguracionNegocio> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // Retraso de red simulado
    return { ...cacheConfiguracionLocal };
  }

  // Consultar registro único
  const { data, error } = await supabase
    .from("configuracion_negocio")
    .select("*")
    .eq("id", 1)
    .maybeSingle(); // Usar maybeSingle para evitar excepciones directas si no hay filas

  if (error) {
    console.error("Error al obtener la configuración del negocio:", error);
    throw new Error(`Error al cargar configuración: ${error.message}`);
  }

  // Si no existe el registro único, lo creamos
  if (!data) {
    console.log("No se encontró configuración con id=1. Inicializando registro por defecto...");
    const { data: nuevaConfig, error: errorInsert } = await supabase
      .from("configuracion_negocio")
      .insert({
        id: 1,
        porcentaje_mora_mes_3: CONFIG_DEFECTO.porcentaje_mora_mes_3,
        dias_gracia_mora: CONFIG_DEFECTO.dias_gracia_mora,
        plantilla_recordatorio_antici: CONFIG_DEFECTO.plantilla_recordatorio_antici,
        plantilla_mora_critica: CONFIG_DEFECTO.plantilla_mora_critica,
      })
      .select()
      .single();

    if (errorInsert || !nuevaConfig) {
      console.error("Error al inicializar la configuración por defecto:", errorInsert);
      throw new Error(`No se pudo inicializar la configuración del negocio: ${errorInsert?.message}`);
    }

    return nuevaConfig as ConfiguracionNegocio;
  }

  return {
    id: data.id,
    porcentaje_mora_mes_3: Number(data.porcentaje_mora_mes_3),
    dias_gracia_mora: Number(data.dias_gracia_mora),
    plantilla_recordatorio_antici: data.plantilla_recordatorio_antici || "",
    plantilla_mora_critica: data.plantilla_mora_critica || "",
    ultima_actualizacion: data.ultima_actualizacion,
  };
}

/**
 * Actualiza la configuración única del negocio (id = 1).
 */
export async function guardarConfiguracion(
  input: Omit<ConfiguracionNegocio, "id" | "ultima_actualizacion">
): Promise<ConfiguracionNegocio> {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    cacheConfiguracionLocal = {
      ...cacheConfiguracionLocal,
      ...input,
    };
    console.log("[configuracionService] Configuración guardada en memoria (Simulado):", cacheConfiguracionLocal);
    return { ...cacheConfiguracionLocal };
  }

  const { data, error } = await supabase
    .from("configuracion_negocio")
    .update({
      porcentaje_mora_mes_3: input.porcentaje_mora_mes_3,
      dias_gracia_mora: input.dias_gracia_mora,
      plantilla_recordatorio_antici: input.plantilla_recordatorio_antici,
      plantilla_mora_critica: input.plantilla_mora_critica,
      ultima_actualizacion: new Date().toISOString(),
    })
    .eq("id", 1)
    .select()
    .single();

  if (error || !data) {
    console.error("Error al actualizar la configuración del negocio:", error);
    throw new Error(`Error al guardar los cambios: ${error?.message || "No retornó datos"}`);
  }

  return {
    id: data.id,
    porcentaje_mora_mes_3: Number(data.porcentaje_mora_mes_3),
    dias_gracia_mora: Number(data.dias_gracia_mora),
    plantilla_recordatorio_antici: data.plantilla_recordatorio_antici || "",
    plantilla_mora_critica: data.plantilla_mora_critica || "",
    ultima_actualizacion: data.ultima_actualizacion,
  };
}
