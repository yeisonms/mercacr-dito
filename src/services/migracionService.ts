import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { format } from "date-fns";

export interface CreditoMigracionInput {
  cedula_cliente: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  barrio: string;
  valor_original_credito: number;
  saldo_pendiente_actual: number;
  valor_cuota: number;
  frecuencia_pago: "Semanal" | "Quincenal" | "Mensual";
  fecha_proximo_pago: string;
  codigo_ruta: string;
  numero_cartera?: string;
}

export function calcularFechaVencimientoMigracion(
  fechaBaseStr: string,
  frecuencia: "Semanal" | "Quincenal" | "Mensual",
  indiceCuotaZeroBased: number
): string {
  const parts = fechaBaseStr.split("-");
  if (parts.length !== 3) return fechaBaseStr;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const day = parseInt(parts[2], 10);
  
  const fecha = new Date(year, month, day);
  
  if (frecuencia === "Semanal") {
    fecha.setDate(fecha.getDate() + 7 * indiceCuotaZeroBased);
  } else if (frecuencia === "Quincenal") {
    fecha.setDate(fecha.getDate() + 15 * indiceCuotaZeroBased);
  } else if (frecuencia === "Mensual") {
    fecha.setMonth(fecha.getMonth() + indiceCuotaZeroBased);
  }
  return format(fecha, "yyyy-MM-dd");
}

async function obtenerVendedorId(): Promise<string> {
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id")
    .limit(1);

  if (usuarios && usuarios.length > 0) {
    return usuarios[0].id;
  }

  const { data: rol } = await supabase
    .from("roles")
    .select("id")
    .eq("nombre_rol", "Vendedor")
    .single();

  const rolId = rol?.id || 4;

  const { data: nuevoUsuario, error } = await supabase
    .from("usuarios")
    .insert({
      nombre_completo: "Vendedor de Migración",
      email: `migracion.default.${Date.now()}@mercacredito.com`,
      password_hash: "migracion_default_pwd_hash",
      rol_id: rolId,
      estado: "Activo",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Error al crear usuario de respaldo: ${error.message}`);
  }

  return nuevoUsuario.id;
}

export async function importarCreditos(
  creditos: CreditoMigracionInput[],
  onProgreso: (actual: number, total: number) => void
): Promise<{ exitosos: number; fallidos: number; errores: string[] }> {
  let exitosos = 0;
  let fallidos = 0;
  const errores: string[] = [];

  if (!isSupabaseConfigured) {
    // Simular importación masiva en desarrollo
    for (let k = 0; k < creditos.length; k++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgreso(k + 1, creditos.length);
      exitosos++;
    }
    return { exitosos, fallidos, errores };
  }

  // 1. Cargar catálogo de rutas para evitar consultas repetidas
  const { data: rutas } = await supabase.from("rutas").select("id, codigo_ruta");
  const mapaRutas = new Map<string, string>();
  if (rutas) {
    rutas.forEach(r => mapaRutas.set(r.codigo_ruta.trim().toUpperCase(), r.id));
  }
  const defaultRutaId = rutas && rutas.length > 0 ? rutas[0].id : null;

  // 2. Obtener vendedor id de respaldo
  const vendedorId = await obtenerVendedorId();

  // 3. Procesar secuencialmente
  for (let k = 0; k < creditos.length; k++) {
    const item = creditos[k];
    try {
      // Paso A: Buscar o insertar el cliente
      let clienteId = "";
      const cedulaLimpia = item.cedula_cliente ? String(item.cedula_cliente).trim() : "";
      
      let clienteExistente = null;
      if (cedulaLimpia) {
        const { data } = await supabase
          .from("clientes")
          .select("id")
          .eq("cedula", cedulaLimpia)
          .maybeSingle();
        clienteExistente = data;
      } else {
        // Si no tiene cédula, buscamos por coincidencia exacta de nombres y apellidos
        const { data } = await supabase
          .from("clientes")
          .select("id")
          .eq("nombres", item.nombres.trim())
          .eq("apellidos", item.apellidos.trim())
          .limit(1)
          .maybeSingle();
        clienteExistente = data;
      }

      if (clienteExistente) {
        clienteId = clienteExistente.id;
        
        // Actualizar la ruta y el número de cartera para mantenerlos al día
        const codigoRutaKey = item.codigo_ruta.trim().toUpperCase();
        const rutaId = mapaRutas.get(codigoRutaKey) || defaultRutaId;
        
        if (rutaId) {
          await supabase
            .from("clientes")
            .update({ 
              ruta_id: rutaId,
              numero_cartera: item.numero_cartera?.trim() || null
            })
            .eq("id", clienteId);
        }
      } else {
        const codigoRutaKey = item.codigo_ruta.trim().toUpperCase();
        const rutaId = mapaRutas.get(codigoRutaKey) || defaultRutaId;
        if (!rutaId) {
          throw new Error(`La ruta con código '${item.codigo_ruta}' no existe y no hay rutas alternativas.`);
        }

        // Generar consecutivo
        const { count } = await supabase
          .from("clientes")
          .select("id", { count: "exact", head: true });
        const codigoConsecutivo = `CLI-${String((count ?? 0) + 1).padStart(5, "0")}`;

        // Generar secuencia visita
        const { data: clientesRuta } = await supabase
          .from("clientes")
          .select("id")
          .eq("ruta_id", rutaId);
        const secuenciaVisita = (clientesRuta?.length ?? 0) + 1;

        const { data: nuevoCliente, error: errorCliente } = await supabase
          .from("clientes")
          .insert({
            ruta_id: rutaId,
            codigo_consecutivo: codigoConsecutivo,
            secuencia_visita: secuenciaVisita,
            nombres: item.nombres.trim(),
            apellidos: item.apellidos.trim(),
            cedula: cedulaLimpia || null,
            telefono_principal: item.telefono.trim(),
            direccion: "Dirección de Migración",
            barrio: item.barrio.trim(),
            ciudad: "Popayan",
            estado: "Activo",
            numero_cartera: item.numero_cartera?.trim() || null,
          })
          .select("id")
          .single();

        if (errorCliente || !nuevoCliente) {
          throw new Error(`No se pudo crear el cliente: ${errorCliente?.message || "Sin ID"}`);
        }
        clienteId = nuevoCliente.id;
      }

      // Paso B: Insertar Crédito (tipo_venta = 'Credito' por constraint DDL)
      const numeroCuotas = Math.ceil(item.saldo_pendiente_actual / item.valor_cuota);
      if (numeroCuotas <= 0) {
        throw new Error("El saldo pendiente y valor de cuota deben dar como resultado al menos 1 cuota.");
      }

      // Redondeo de cuota a múltiplo de 1000 más cercano
      const cuotaBase = item.saldo_pendiente_actual / numeroCuotas;
      const valorCuotaRedondeada = Math.ceil(cuotaBase / 1000) * 1000;
      const ultimaCuotaRemanente = item.saldo_pendiente_actual - (valorCuotaRedondeada * (numeroCuotas - 1));

      // Calcular fecha final estimada
      const fechaFinalEstimada = calcularFechaVencimientoMigracion(
        item.fecha_proximo_pago,
        item.frecuencia_pago,
        numeroCuotas - 1
      );

      const { data: nuevoCredito, error: errorCredito } = await supabase
        .from("creditos")
        .insert({
          cliente_id: clienteId,
          vendedor_id: vendedorId,
          numero_factura: `MIG-${item.cedula_cliente.trim()}-${Math.floor(100 + Math.random() * 900)}`,
          tipo_venta: "Credito", // DDL constraint
          valor_contado: item.valor_original_credito,
          valor_credito: item.valor_original_credito,
          cuota_inicial: Math.max(0, item.valor_original_credito - item.saldo_pendiente_actual),
          saldo_pendiente: item.saldo_pendiente_actual,
          numero_cuotas: numeroCuotas,
          valor_cuota: valorCuotaRedondeada,
          frecuencia_pago: item.frecuencia_pago,
          fecha_proximo_pago: item.fecha_proximo_pago,
          fecha_final_estimada: fechaFinalEstimada,
          estado: "Al día",
        })
        .select("id")
        .single();

      if (errorCredito || !nuevoCredito) {
        throw new Error(`No se pudo crear el crédito: ${errorCredito?.message || "Sin ID"}`);
      }

      // Paso C: Proyectar e insertar cuotas
      const cuotasParaInsertar = [];
      for (let i = 0; i < numeroCuotas; i++) {
        const fechaVencimiento = calcularFechaVencimientoMigracion(
          item.fecha_proximo_pago,
          item.frecuencia_pago,
          i
        );

        const esUltima = i === numeroCuotas - 1;
        const valorMonto = esUltima ? ultimaCuotaRemanente : valorCuotaRedondeada;

        cuotasParaInsertar.push({
          credito_id: nuevoCredito.id,
          numero_cuota: i + 1,
          fecha_vencimiento: fechaVencimiento,
          valor_cuota: valorMonto,
          valor_pagado: 0,
          saldo_cuota: valorMonto,
          estado: "Pendiente",
        });
      }

      const { error: errorCuotas } = await supabase
        .from("cuotas")
        .insert(cuotasParaInsertar);

      if (errorCuotas) {
        // Rollback
        await supabase.from("creditos").delete().eq("id", nuevoCredito.id);
        throw new Error(`No se pudieron crear las cuotas: ${errorCuotas.message}`);
      }

      exitosos++;
    } catch (e: any) {
      fallidos++;
      errores.push(`Fila ${k + 1} (${item.nombres} ${item.apellidos}): ${e.message || e}`);
    }

    onProgreso(k + 1, creditos.length);
  }

  return { exitosos, fallidos, errores };
}
