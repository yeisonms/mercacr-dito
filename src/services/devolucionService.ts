/**
 * devolucionService.ts
 * Servicio para procesar la devolución de productos al almacén,
 * ajuste de inventario, recálculo de deudas y redirección de dinero
 * (cuotas iniciales o abonos previos) hacia otros créditos o devolución en efectivo.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sincronizarCreditoYCuotas } from "./recaudoService";

export interface CreditoDestinoOpcion {
  id: string;
  numeroFactura: string;
  saldoPendiente: number;
  fechaVenta: string;
  tipoVenta: string;
}

export interface ResumenPagosCredito {
  totalPagado: number;
  cuotaInicial: number;
  cantidadRecaudos: number;
  saldoPendiente: number;
  valorCredito: number;
  numeroFactura: string;
}

export interface ProcesarDevolucionInput {
  creditoId: string;
  clienteId: string;
  usuarioId: string;
  esDevolucionTotal: boolean;
  productoId?: string;
  detalleVentaId?: string;
  productoNombre?: string;
  cantidadDevolver: number;
  precioAplicado: number;
  subtotal: number;
  motivo: string;
  estadoFisico: "Bueno" | "Garantia_Proveedor";
  destinoDinero: "Abono_Otro_Credito" | "Devolucion_Efectivo" | "Saldo_Favor" | "Conservado_En_Compra";
  creditoDestinoId?: string;
  montoReconocido: number;
}

/**
 * Obtiene otros créditos activos del cliente a los que se les puede transferir
 * el dinero de una cuota inicial o abono como abono de deuda.
 */
export async function obtenerCreditosDestinoParaCliente(
  clienteId: string,
  creditoExcluirId: string
): Promise<CreditoDestinoOpcion[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("creditos")
    .select("id, numero_factura, saldo_pendiente, fecha_venta, tipo_venta")
    .eq("cliente_id", clienteId)
    .neq("id", creditoExcluirId)
    .gt("saldo_pendiente", 0)
    .not("estado", "in", '("Finalizado","Cancelado","Devuelto")')
    .order("fecha_venta", { ascending: false });

  if (error) {
    console.error("[devolucionService] Error obteniendo créditos destino:", error);
    return [];
  }

  return (data || []).map((c) => ({
    id: c.id,
    numeroFactura: c.numero_factura,
    saldoPendiente: Number(c.saldo_pendiente) || 0,
    fechaVenta: c.fecha_venta,
    tipoVenta: c.tipo_venta,
  }));
}

/**
 * Obtiene el resumen financiero de lo que el cliente ha pagado en un crédito
 * (incluyendo cuota inicial y abonos registrados).
 */
export async function obtenerResumenPagosCredito(creditoId: string): Promise<ResumenPagosCredito> {
  if (!isSupabaseConfigured) {
    return {
      totalPagado: 0,
      cuotaInicial: 0,
      cantidadRecaudos: 0,
      saldoPendiente: 0,
      valorCredito: 0,
      numeroFactura: "",
    };
  }

  // 1. Obtener crédito
  const { data: credito, error: credError } = await supabase
    .from("creditos")
    .select("numero_factura, saldo_pendiente, valor_credito, cuota_inicial")
    .eq("id", creditoId)
    .single();

  if (credError || !credito) {
    throw new Error(`Error obteniendo crédito: ${credError?.message || "No encontrado"}`);
  }

  // 2. Obtener recaudos aprobados
  const { data: recaudos, error: recError } = await supabase
    .from("recaudos")
    .select("valor_recibido")
    .eq("credito_id", creditoId)
    .eq("estado", "Aprobado");

  if (recError) {
    console.error("[devolucionService] Error obteniendo recaudos:", recError);
  }

  const totalPagado = (recaudos || []).reduce(
    (acc, r) => acc + (Number(r.valor_recibido) || 0),
    0
  );

  return {
    totalPagado,
    cuotaInicial: Number(credito.cuota_inicial) || 0,
    cantidadRecaudos: recaudos?.length || 0,
    saldoPendiente: Number(credito.saldo_pendiente) || 0,
    valorCredito: Number(credito.valor_credito) || 0,
    numeroFactura: credito.numero_factura,
  };
}

/**
 * Procesa la devolución de un producto o de la venta completa:
 * 1. Reintegra la mercancía al inventario (stock_disponible).
 * 2. Ajusta o cancela el crédito original (y recalcula cuotas pendientes).
 * 3. Si hubo cuota inicial / abonos y se eligió abonar a otro crédito, crea el recaudo y amortiza.
 * 4. Deja registro de auditoría.
 */
export async function procesarDevolucionProducto(input: ProcesarDevolucionInput): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase no está configurado.");
  }
  if (!input.motivo.trim()) {
    throw new Error("El motivo de la devolución es obligatorio.");
  }

  // ─── PASO 1: Reintegrar stock al inventario ───────────────────────────
  if (input.esDevolucionTotal) {
    // Si es total, devolver todos los productos asociados a este crédito
    const { data: detalles, error: detError } = await supabase
      .from("detalles_venta")
      .select("producto_id, cantidad")
      .eq("credito_id", input.creditoId);

    if (detError) throw new Error(`Error al leer detalles de venta: ${detError.message}`);

    if (detalles && detalles.length > 0) {
      for (const d of detalles) {
        if (!d.producto_id) continue;
        const { data: prod } = await supabase
          .from("productos")
          .select("stock_disponible")
          .eq("id", d.producto_id)
          .single();

        if (prod) {
          await supabase
            .from("productos")
            .update({ stock_disponible: (prod.stock_disponible || 0) + Number(d.cantidad || 0) })
            .eq("id", d.producto_id);
        }
      }
    }
  } else if (input.productoId && input.cantidadDevolver > 0) {
    // Devolución de un producto específico
    const { data: prod, error: pError } = await supabase
      .from("productos")
      .select("stock_disponible")
      .eq("id", input.productoId)
      .single();

    if (pError) throw new Error(`Error al obtener producto: ${pError.message}`);

    if (prod) {
      await supabase
        .from("productos")
        .update({
          stock_disponible: (prod.stock_disponible || 0) + Number(input.cantidadDevolver),
        })
        .eq("id", input.productoId);
    }
  }

  // ─── PASO 2: Modificar crédito original y cuotas ───────────────────────
  const { data: creditoOrigen, error: errCreditoOrigen } = await supabase
    .from("creditos")
    .select("numero_factura, valor_credito, valor_contado, saldo_pendiente, saldo_contado")
    .eq("id", input.creditoId)
    .single();

  if (errCreditoOrigen || !creditoOrigen) {
    throw new Error("No se encontró el crédito de origen a devolver.");
  }

  const facturaOrigen = creditoOrigen.numero_factura || "S/F";

  if (input.esDevolucionTotal) {
    // A. Devolución Total: Marcar crédito como Devuelto y saldo en 0
    const { error: errUpdateCred } = await supabase
      .from("creditos")
      .update({
        estado: "Devuelto",
        saldo_pendiente: 0,
        saldo_contado: 0,
        motivo_devolucion: input.motivo,
        fecha_devolucion: new Date().toISOString(),
      })
      .eq("id", input.creditoId);

    if (errUpdateCred) throw new Error(`Error al actualizar crédito: ${errUpdateCred.message}`);

    // Cancelar cuotas pendientes sin pagos
    await supabase
      .from("cuotas")
      .delete()
      .eq("credito_id", input.creditoId)
      .eq("valor_pagado", 0);

  } else {
    // B. Devolución Parcial (un solo producto de la venta)
    // 1. Descontar o eliminar el registro en detalles_venta
    if (input.detalleVentaId) {
      const { data: detItem } = await supabase
        .from("detalles_venta")
        .select("id, cantidad, precio_aplicado, subtotal")
        .eq("id", input.detalleVentaId)
        .single();

      if (detItem) {
        const cantActual = Number(detItem.cantidad) || 0;
        if (cantActual <= input.cantidadDevolver) {
          await supabase.from("detalles_venta").delete().eq("id", input.detalleVentaId);
        } else {
          const nvaCant = cantActual - input.cantidadDevolver;
          const nvoSub = nvaCant * (Number(detItem.precio_aplicado) || 0);
          await supabase
            .from("detalles_venta")
            .update({ cantidad: nvaCant, subtotal: nvoSub })
            .eq("id", input.detalleVentaId);
        }
      }
    }

    // 2. Reducir valor_credito y saldo_contado del crédito
    const nvoValorCredito = Math.max(0, Number(creditoOrigen.valor_credito) - input.subtotal);
    const nvoValorContado = creditoOrigen.valor_contado != null
      ? Math.max(0, Number(creditoOrigen.valor_contado) - input.subtotal)
      : null;

    const { error: errCredParcial } = await supabase
      .from("creditos")
      .update({
        valor_credito: nvoValorCredito,
        valor_contado: nvoValorContado,
      })
      .eq("id", input.creditoId);

    if (errCredParcial) throw new Error(`Error al actualizar crédito parcial: ${errCredParcial.message}`);

    // 3. Sincronizar y recalcular cuotas con el nuevo saldo
    await sincronizarCreditoYCuotas(input.creditoId);
  }

  // ─── PASO 3: Redirección del dinero pagado (Monto Reconocido) ───────────
  if (input.montoReconocido > 0) {
    if (input.destinoDinero === "Abono_Otro_Credito" && input.creditoDestinoId) {
      // Registrar abono en el crédito destino
      const prodTxt = input.productoNombre ? ` (${input.productoNombre})` : "";
      const obsAbono = `Abono por devolución de producto${prodTxt} de factura ${facturaOrigen}. Motivo: ${input.motivo}`;

      const { error: errRecaudoDestino } = await supabase
        .from("recaudos")
        .insert({
          credito_id: input.creditoDestinoId,
          cobrador_id: input.usuarioId,
          valor_recibido: input.montoReconocido,
          metodo_pago: "Efectivo",
          estado: "Aprobado",
          observaciones: obsAbono,
        });

      if (errRecaudoDestino) {
        console.error("[devolucionService] Error creando recaudo destino:", errRecaudoDestino);
        throw new Error(`Error al aplicar abono al crédito destino: ${errRecaudoDestino.message}`);
      }

      // Sincronizar saldos y cuotas del crédito que recibió el abono
      await sincronizarCreditoYCuotas(input.creditoDestinoId);
    }
  }

  // ─── PASO 4: Auditoría y trazabilidad ─────────────────────────────────
  // A. Intentar insertar en tabla especializada devoluciones_productos
  try {
    await supabase.from("devoluciones_productos").insert({
      credito_id: input.creditoId,
      producto_id: input.productoId || null,
      cliente_id: input.clienteId,
      usuario_id: input.usuarioId || null,
      cantidad: input.cantidadDevolver,
      precio_producto: input.precioAplicado,
      subtotal_devuelto: input.subtotal,
      monto_dinero_reconocido: input.montoReconocido,
      destino_dinero: input.destinoDinero,
      credito_destino_id: input.creditoDestinoId || null,
      motivo: input.motivo,
      estado_fisico: input.estadoFisico,
      fecha_devolucion: new Date().toISOString(),
    });
  } catch (err) {
    // Si la tabla devoluciones_productos no ha sido creada aún en Supabase, no romper la transacción
    console.warn("[devolucionService] Advertencia: no se pudo insertar en devoluciones_productos:", err);
  }

  // B. Insertar en logs_auditoria siempre
  try {
    await supabase.from("logs_auditoria").insert({
      usuario_id: input.usuarioId || null,
      accion: input.esDevolucionTotal ? "DEVOLUCION_TOTAL_VENTA" : "DEVOLUCION_PARCIAL_PRODUCTO",
      tabla_afectada: "creditos",
      registro_id: input.creditoId,
      valores_anteriores: {
        factura: facturaOrigen,
        saldo_pendiente: creditoOrigen.saldo_pendiente,
        valor_credito: creditoOrigen.valor_credito,
      },
      valores_nuevos: {
        producto: input.productoNombre || "Todos",
        cantidad_devuelta: input.cantidadDevolver,
        monto_reconocido: input.montoReconocido,
        destino_dinero: input.destinoDinero,
        credito_destino_id: input.creditoDestinoId || null,
        motivo: input.motivo,
        estado_fisico: input.estadoFisico,
      },
    });
  } catch (err) {
    console.error("[devolucionService] Error al insertar en logs_auditoria:", err);
  }
}
