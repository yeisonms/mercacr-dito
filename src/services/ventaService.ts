/**
 * ventaService.ts
 * Servicio transaccional para procesar ventas y originar créditos.
 * Interactúa con las tablas: creditos, detalles_venta, cuotas y usuarios.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface CarritoItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioAplicado: number;
  subtotal: number;
}

export interface ProcesarVentaInput {
  clienteId: string;
  tipoVenta: "Contado" | "Credito";
  valorContado: number;
  valorCredito: number;
  cuotaInicial: number;
  saldoPendiente: number;
  numeroCuotas: number;
  valorCuota: number;
  frecuenciaPago: "Semanal" | "Quincenal" | "Mensual" | null;
  carrito: CarritoItem[];
  fechaProximoPago?: string | null;
  fechaFinalEstimada?: string | null;
}

/**
 * Calcula la fecha de vencimiento según la frecuencia de pago y el número de cuota.
 */
export function calcularFechaVencimiento(
  fechaBase: Date,
  frecuencia: "Semanal" | "Quincenal" | "Mensual",
  numeroCuota: number
): string {
  const fecha = new Date(fechaBase);
  if (frecuencia === "Semanal") {
    fecha.setDate(fecha.getDate() + 7 * numeroCuota);
  } else if (frecuencia === "Quincenal") {
    fecha.setDate(fecha.getDate() + 15 * numeroCuota);
  } else if (frecuencia === "Mensual") {
    fecha.setMonth(fecha.getMonth() + numeroCuota);
  }
  return fecha.toISOString().split("T")[0];
}

/**
 * Obtiene o crea un vendedor_id válido de la tabla `usuarios`
 * para satisfacer la clave foránea en la tabla `creditos`.
 */
async function obtenerVendedorId(): Promise<string> {
  // 1. Intentar obtener el primer usuario disponible
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id")
    .limit(1);

  if (usuarios && usuarios.length > 0) {
    return usuarios[0].id;
  }

  // 2. Si no hay usuarios, buscamos el rol 'Vendedor' u obtenemos el primero
  const { data: rol } = await supabase
    .from("roles")
    .select("id")
    .eq("nombre_rol", "Vendedor")
    .single();

  const rolId = rol?.id || 4; // fallback al rol Vendedor (ID 4)

  // 3. Crear un vendedor por defecto
  const { data: nuevoUsuario, error } = await supabase
    .from("usuarios")
    .insert({
      nombre_completo: "Vendedor por Defecto",
      email: `vendedor.default.${Date.now()}@mercacredito.com`,
      password_hash: "vendedor_default_pwd_hash",
      rol_id: rolId,
      estado: "Activo",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Error al crear usuario vendedor de respaldo: ${error.message}`);
  }

  return nuevoUsuario.id;
}

/**
 * Procesa la venta y genera las relaciones correspondientes de forma secuencial.
 */
export async function procesarVenta(input: ProcesarVentaInput): Promise<{
  creditoId: string;
  numeroFactura: string;
}> {
  if (!isSupabaseConfigured) {
    // Simular retraso y éxito si Supabase no está configurado
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const mockFactura = `FAC-${Math.floor(1000 + Math.random() * 9000)}`;
    console.log("[ventaService] Venta simulada con éxito:", {
      input,
      mockFactura,
    });
    return {
      creditoId: "mock-credito-id",
      numeroFactura: mockFactura,
    };
  }

  // Generamos número de factura único
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const numeroFactura = `FAC-${randomSuffix}`;

  // Obtener un ID de vendedor válido
  const vendedorId = await obtenerVendedorId();

  // Paso A: Insertar el encabezado de la venta en la tabla creditos
  const fechaVenta = new Date();
  
  // Calcular fechas de cuotas si aplica
  let fechaProximoPago: string | null = null;
  let fechaFinalEstimada: string | null = null;

  if (input.fechaProximoPago) {
    fechaProximoPago = input.fechaProximoPago;
  } else if (input.tipoVenta === "Credito" && input.frecuenciaPago) {
    fechaProximoPago = calcularFechaVencimiento(fechaVenta, input.frecuenciaPago, 1);
  }

  if (input.fechaFinalEstimada) {
    fechaFinalEstimada = input.fechaFinalEstimada;
  } else if (input.tipoVenta === "Credito" && input.frecuenciaPago) {
    fechaFinalEstimada = calcularFechaVencimiento(
      fechaVenta,
      input.frecuenciaPago,
      input.numeroCuotas
    );
  }

  // Estado del crédito
  const estadoCredito = input.tipoVenta === "Contado" ? "Finalizado" : "Al día";

  const { data: credito, error: errorCredito } = await supabase
    .from("creditos")
    .insert({
      cliente_id: input.clienteId,
      vendedor_id: vendedorId,
      numero_factura: numeroFactura,
      tipo_venta: input.tipoVenta, // Guarda 'Contado' o 'Credito'
      valor_contado: input.valorContado,
      valor_credito: input.valorCredito,
      cuota_inicial: input.tipoVenta === "Credito" ? input.cuotaInicial : 0,
      saldo_pendiente: input.tipoVenta === "Credito" ? input.saldoPendiente : 0,
      numero_cuotas: input.tipoVenta === "Credito" ? input.numeroCuotas : 0,
      valor_cuota: input.tipoVenta === "Credito" ? input.valorCuota : 0,
      // Para Contado: se envía 'Mensual' como valor neutro si la columna tiene NOT NULL.
      // Semánticamente no aplica, pero evita el constraint error.
      // Solución definitiva: ALTER TABLE creditos ALTER COLUMN frecuencia_pago DROP NOT NULL;
      frecuencia_pago: input.tipoVenta === "Credito" ? input.frecuenciaPago : "Mensual",
      fecha_proximo_pago: fechaProximoPago,
      fecha_final_estimada: fechaFinalEstimada,
      estado: estadoCredito,
    })
    .select("id")
    .single();

  if (errorCredito || !credito) {
    throw new Error(`Error en el paso A (Crear Crédito): ${errorCredito?.message || "No retornó ID"}`);
  }

  const creditoId = credito.id;

  // Paso B: Insertar masivamente en la tabla detalles_venta
  const detalles = input.carrito.map((item) => ({
    credito_id: creditoId,
    producto_id: item.productoId,
    cantidad: item.cantidad,
    precio_aplicado: item.precioAplicado,
    subtotal: item.subtotal,
  }));

  const { error: errorDetalles } = await supabase
    .from("detalles_venta")
    .insert(detalles);

  if (errorDetalles) {
    // Si falla, intentamos limpiar el encabezado para mantener consistencia
    await supabase.from("creditos").delete().eq("id", creditoId);
    throw new Error(`Error en el paso B (Insertar Detalles): ${errorDetalles.message}`);
  }

  // Paso C: Si la venta es a Crédito, generar y guardar las cuotas
  if (input.tipoVenta === "Credito" && input.frecuenciaPago && input.numeroCuotas > 0) {
    const cuotasParaInsertar = [];
    
    let totalAcumuladoCuotas = 0;
    for (let i = 1; i <= input.numeroCuotas; i++) {
      const fechaVencimiento = calcularFechaVencimiento(
        fechaVenta,
        input.frecuenciaPago,
        i
      );

      let valorCuotaActual = input.valorCuota;
      if (i === input.numeroCuotas) {
        // Ajustar la última cuota al saldo restante exacto para evitar diferencias por redondeo
        valorCuotaActual = input.saldoPendiente - totalAcumuladoCuotas;
      } else {
        totalAcumuladoCuotas += valorCuotaActual;
      }

      cuotasParaInsertar.push({
        credito_id: creditoId,
        numero_cuota: i,
        fecha_vencimiento: fechaVencimiento,
        valor_cuota: valorCuotaActual,
        valor_pagado: 0,
        saldo_cuota: valorCuotaActual,
        estado: "Pendiente",
      });
    }

    const { error: errorCuotas } = await supabase
      .from("cuotas")
      .insert(cuotasParaInsertar);

    if (errorCuotas) {
      // Intento de Rollback manual si falla la inserción de cuotas
      await supabase.from("detalles_venta").delete().eq("credito_id", creditoId);
      await supabase.from("creditos").delete().eq("id", creditoId);
      throw new Error(`Error en el paso C (Generar Cuotas): ${errorCuotas.message}`);
    }
  }

  return {
    creditoId,
    numeroFactura,
  };
}
