import { supabase } from "@/lib/supabase";
import { differenceInDays } from "date-fns";

export interface ClienteMoroso {
  creditoId: string;
  clienteId: string;
  nombreCliente: string;
  telefono: string;
  saldoVencido: number;
  diasAtraso: number; // Días desde la cuota más antigua
  ultimoAviso: string | null;
  fechaFinalEstimada: string | null;
  saldoPendienteTotal: number;
  diasDesdeVencimientoFinal: number; // > 0 significa que ya superó la fecha final
  ultimaPenalidadVencimiento: string | null;
}

export const obtenerCarteraMorosa = async (): Promise<ClienteMoroso[]> => {
  const { data, error } = await supabase
    .from("creditos")
    .select(`
      id,
      estado,
      fecha_final_estimada,
      saldo_pendiente,
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
        fecha_envio,
        tipo_disparador
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
    // 1. Cuotas atrasadas (para saldo vencido general y días de atraso)
    const cuotasAtrasadas = (row.cuotas || []).filter((cuota: any) => {
      if (cuota.estado !== "Pendiente" && cuota.estado !== "Parcial") return false;
      const fechaVenc = new Date(cuota.fecha_vencimiento + "T12:00:00");
      fechaVenc.setHours(0, 0, 0, 0);
      return fechaVenc < hoy;
    });

    if (cuotasAtrasadas.length === 0) continue;

    cuotasAtrasadas.sort((a: any, b: any) => {
      return new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
    });

    const cuotaMasAntigua = cuotasAtrasadas[0];
    const fechaVencMasAntigua = new Date(cuotaMasAntigua.fecha_vencimiento + "T12:00:00");
    fechaVencMasAntigua.setHours(0, 0, 0, 0);
    const diasAtraso = differenceInDays(hoy, fechaVencMasAntigua);
    const saldoVencido = cuotasAtrasadas.reduce((acc: number, c: any) => acc + Number(c.saldo_cuota), 0);

    // 2. Avisos y penalidades
    let ultimoAviso = null;
    let ultimaPenalidadVencimiento = null;

    if (row.historial_alertas && row.historial_alertas.length > 0) {
      const alertas = [...row.historial_alertas].sort(
        (a: any, b: any) => new Date(b.fecha_envio).getTime() - new Date(a.fecha_envio).getTime()
      );
      ultimoAviso = alertas[0].fecha_envio;
      
      const ultimaPenalidad = alertas.find((a: any) => a.tipo_disparador === "Penalidad Mora Vencimiento");
      if (ultimaPenalidad) ultimaPenalidadVencimiento = ultimaPenalidad.fecha_envio;
    }

    // 3. Vencimiento final del crédito
    let diasDesdeVencimientoFinal = 0;
    if (row.fecha_final_estimada) {
      const fechaFinal = new Date(row.fecha_final_estimada + "T12:00:00");
      fechaFinal.setHours(0, 0, 0, 0);
      diasDesdeVencimientoFinal = differenceInDays(hoy, fechaFinal);
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
      fechaFinalEstimada: row.fecha_final_estimada,
      saldoPendienteTotal: Number(row.saldo_pendiente),
      diasDesdeVencimientoFinal,
      ultimaPenalidadVencimiento,
    });
  }

  // Ordenar por más días de atraso
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

export const aplicarPenalidadIndividual = async (
  cliente: ClienteMoroso,
  porcentaje: number
): Promise<void> => {
  const penalidad = Math.round(cliente.saldoPendienteTotal * (porcentaje / 100));
  if (penalidad <= 0) return;

  // 1. Obtener todas las cuotas pendientes o parciales
  const { data: cuotas, error: cuotasError } = await supabase
    .from("cuotas")
    .select("id, saldo_cuota, valor_cuota")
    .eq("credito_id", cliente.creditoId)
    .in("estado", ["Pendiente", "Parcial"])
    .order("fecha_vencimiento", { ascending: true });

  if (cuotasError || !cuotas || cuotas.length === 0) {
    throw new Error(`Error obteniendo cuotas para crédito ${cliente.creditoId}`);
  }

  // 2. Distribuir equitativamente la penalidad
  const cuotasActivas = cuotas.length;
  const adicionBase = Math.floor(penalidad / cuotasActivas);
  const residuo = penalidad % cuotasActivas;

  for (let i = 0; i < cuotasActivas; i++) {
    const cuota = cuotas[i];
    // Agregar el residuo a la última cuota para cuadrar el centavo
    const montoSumar = i === cuotasActivas - 1 ? adicionBase + residuo : adicionBase;
    
    const nuevoSaldoCuota = Number(cuota.saldo_cuota) + montoSumar;
    const nuevoValorCuota = Number(cuota.valor_cuota) + montoSumar;
    
    await supabase.from("cuotas").update({ 
      saldo_cuota: nuevoSaldoCuota,
      valor_cuota: nuevoValorCuota
    }).eq("id", cuota.id);
  }

  // 3. Update crédito (sumar la penalidad total)
  const { data: creditoInfo } = await supabase
    .from("creditos")
    .select("saldo_pendiente, valor_credito")
    .eq("id", cliente.creditoId)
    .single();

  if (creditoInfo) {
    const nuevoSaldoPendiente = Number(creditoInfo.saldo_pendiente) + penalidad;
    const nuevoValorCredito = Number(creditoInfo.valor_credito) + penalidad;
    
    await supabase.from("creditos").update({ 
      saldo_pendiente: nuevoSaldoPendiente,
      valor_credito: nuevoValorCredito
    }).eq("id", cliente.creditoId);
  }

  // 4. Registrar en historial para validar los 30 días la próxima vez
  const formatter = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
  await supabase.from("historial_alertas").insert({
    cliente_id: cliente.clienteId,
    credito_id: cliente.creditoId,
    tipo_medio: "WhatsApp",
    tipo_disparador: "Penalidad Mora Vencimiento",
    mensaje_enviado: `Sistema: Recargo automático del ${porcentaje}% (${formatter.format(penalidad)}) aplicado al saldo total. Distribuido en ${cuotasActivas} cuotas pendientes.`,
    estado_envio: "Enviado",
  });
};
