import { supabase } from "@/lib/supabase";
import { differenceInDays } from "date-fns";

export interface ClienteMoroso {
  creditoId: string;
  clienteId: string;
  nombreCliente: string;
  telefono: string;
  saldoVencido: number;
  diasAtraso: number;
  ultimoAviso: string | null;
}

export const obtenerCarteraMorosa = async (): Promise<ClienteMoroso[]> => {
  // Obtenemos todos los créditos activos, junto a sus cuotas, cliente e historial_alertas
  // NOTA: Traemos todas las cuotas de cada crédito para poder calcular los días de atraso en base a la más antigua sin pagar.
  const { data, error } = await supabase
    .from("creditos")
    .select(`
      id,
      estado,
      clientes (
        id,
        nombres,
        apellidos,
        telefono_principal
      ),
      cuotas (
        id,
        fecha_vencimiento,
        saldo_cuota,
        estado
      ),
      historial_alertas (
        fecha_envio
      )
    `)
    .in("estado", ["Al día", "Próximo a vencer", "Atrasado", "En mora"]);

  if (error) {
    throw new Error(`Error al cargar la cartera: ${error.message}`);
  }

  const morosos: ClienteMoroso[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (const row of data || []) {
    // Verificar cuotas vencidas (estado Pendiente o Parcial, y fecha anterior a hoy)
    const cuotasAtrasadas = (row.cuotas || []).filter((cuota: any) => {
      if (cuota.estado !== "Pendiente" && cuota.estado !== "Parcial") return false;
      const fechaVencimiento = new Date(cuota.fecha_vencimiento + "T12:00:00");
      fechaVencimiento.setHours(0, 0, 0, 0);
      return fechaVencimiento < hoy;
    });

    if (cuotasAtrasadas.length === 0) {
      continue; // No tiene mora
    }

    // Calcular días de atraso basándose en la cuota más antigua
    // Ordenar de más antigua a más reciente
    cuotasAtrasadas.sort((a: any, b: any) => {
      return new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
    });

    const cuotaMasAntigua = cuotasAtrasadas[0];
    const fechaVencMasAntigua = new Date(cuotaMasAntigua.fecha_vencimiento + "T12:00:00");
    fechaVencMasAntigua.setHours(0, 0, 0, 0);

    const diasAtraso = differenceInDays(hoy, fechaVencMasAntigua);
    const saldoVencido = cuotasAtrasadas.reduce((acc: number, c: any) => acc + Number(c.saldo_cuota), 0);

    // Obtener la última fecha de aviso si existe
    let ultimoAviso = null;
    if (row.historial_alertas && row.historial_alertas.length > 0) {
      // Ordenar descendente por fecha_envio
      const alertas = [...row.historial_alertas].sort(
        (a: any, b: any) => new Date(b.fecha_envio).getTime() - new Date(a.fecha_envio).getTime()
      );
      ultimoAviso = alertas[0].fecha_envio;
    }

    const clienteObj = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;

    morosos.push({
      creditoId: row.id,
      clienteId: clienteObj.id,
      nombreCliente: `${clienteObj.nombres} ${clienteObj.apellidos}`,
      telefono: clienteObj.telefono_principal || "",
      saldoVencido,
      diasAtraso,
      ultimoAviso,
    });
  }

  // Ordenar de mayor a menor día de atraso
  return morosos.sort((a, b) => b.diasAtraso - a.diasAtraso);
};

export const registrarAlertaCobro = async (
  clienteId: string,
  creditoId: string,
  mensaje: string
): Promise<void> => {
  const { error } = await supabase.from("historial_alertas").insert({
    cliente_id: clienteId,
    credito_id: creditoId,
    tipo_medio: "WhatsApp",
    tipo_disparador: "Manual",
    mensaje_enviado: mensaje,
    estado_envio: "Enviado",
  });

  if (error) {
    throw new Error(`Error al registrar alerta: ${error.message}`);
  }
};
