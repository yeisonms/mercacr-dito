import { supabase } from "@/lib/supabase";

export interface RegistrarPromesaInput {
  clienteId: string;
  creditoId: string;
  cobradorId: string;
  fechaCompromiso: string; // YYYY-MM-DD
  observaciones: string;
}

export const registrarPromesaPago = async (input: RegistrarPromesaInput) => {
  // Paso A: Insertar en registro_visitas
  const { data: visitaData, error: errorVisita } = await supabase
    .from("registro_visitas")
    .insert({
      cliente_id: input.clienteId,
      cobrador_id: input.cobradorId,
      estado_gestion: "Promesa de Pago",
      observaciones: input.observaciones,
    })
    .select()
    .single();

  if (errorVisita) {
    throw new Error(`Error al registrar gestión de visita: ${errorVisita.message}`);
  }

  // Paso Intermedio: Insertar en promesas_pago (según esquema BD)
  const { error: errorPromesa } = await supabase
    .from("promesas_pago")
    .insert({
      registro_visita_id: visitaData.id,
      fecha_compromiso: input.fechaCompromiso,
      estado: "Pendiente",
    });

  if (errorPromesa) {
    console.warn("Advertencia: No se pudo insertar en promesas_pago", errorPromesa.message);
  }

  // Paso B: Actualizar el crédito del cliente para reprogramarlo en la ruta
  const { error: errorCredito } = await supabase
    .from("creditos")
    .update({
      fecha_proximo_pago: input.fechaCompromiso,
    })
    .eq("id", input.creditoId);

  if (errorCredito) {
    throw new Error(`Error al actualizar fecha de próximo pago del crédito: ${errorCredito.message}`);
  }

  return true;
};

export interface GestionHistorial {
  id: string;
  fecha_registro: string;
  estado_gestion: string;
  observaciones: string;
  cobrador: {
    nombre_completo: string;
  };
  recaudo?: {
    valor_recibido: number;
    metodo_pago: string;
  } | null;
  promesa?: {
    fecha_compromiso: string;
    estado: string;
  } | null;
}

export const obtenerHistorialGestiones = async (clienteId: string): Promise<GestionHistorial[]> => {
  const { data, error } = await supabase
    .from("registro_visitas")
    .select(`
      id,
      fecha_registro,
      estado_gestion,
      observaciones,
      cobrador:usuarios (nombre_completo),
      recaudos (valor_recibido, metodo_pago),
      promesas_pago (fecha_compromiso, estado)
    `)
    .eq("cliente_id", clienteId)
    .order("fecha_registro", { ascending: false });

  if (error) {
    throw new Error(`Error al obtener historial: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    fecha_registro: row.fecha_registro,
    estado_gestion: row.estado_gestion,
    observaciones: row.observaciones,
    cobrador: Array.isArray(row.cobrador) ? row.cobrador[0] : row.cobrador,
    recaudo: Array.isArray(row.recaudos) ? row.recaudos[0] : row.recaudos,
    promesa: Array.isArray(row.promesas_pago) ? row.promesas_pago[0] : row.promesas_pago,
  }));
};
