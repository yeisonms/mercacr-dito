import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { compararPorNumeroCartera } from '@/services/cliente.service';

/**
 * Exporta la Cartera Activa: únicamente créditos con saldo_pendiente > 0.
 * Ordenado de forma natural por # Cartera ascendente.
 */
export async function descargarCarteraActivaExcel(): Promise<void> {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('creditos')
      .select(`
        saldo_pendiente,
        valor_credito,
        estado,
        fecha_proximo_pago,
        cliente:clientes (
          codigo_consecutivo,
          numero_cartera,
          cedula,
          nombres,
          apellidos,
          telefono_principal,
          barrio,
          direccion
        )
      `)
      .gt('saldo_pendiente', 0)
      .range(from, from + step - 1);

    if (error) {
      console.error('Error al obtener datos para exportar cartera activa:', error);
      throw new Error('No se pudo obtener la cartera de clientes');
    }

    allData = [...allData, ...(data || [])];

    if (data && data.length < step) {
      hasMore = false;
    } else {
      from += step;
    }
  }

  if (!allData || allData.length === 0) {
    throw new Error('No hay créditos activos para exportar');
  }

  // Ordenar alfanuméricamente por # Cartera ascendente
  allData.sort((a: any, b: any) => {
    const clienteA = Array.isArray(a.cliente) ? a.cliente[0] : a.cliente;
    const clienteB = Array.isArray(b.cliente) ? b.cliente[0] : b.cliente;

    return compararPorNumeroCartera(
      {
        numero_cartera: clienteA?.numero_cartera,
        codigo_consecutivo: clienteA?.codigo_consecutivo,
      },
      {
        numero_cartera: clienteB?.numero_cartera,
        codigo_consecutivo: clienteB?.codigo_consecutivo,
      },
      'asc'
    );
  });

  const datosExcel = allData.map((item: any) => {
    const cliente = Array.isArray(item.cliente) ? item.cliente[0] : item.cliente;
    
    let diasAtraso = 0;
    if (item.fecha_proximo_pago) {
      const fechaPago = new Date(item.fecha_proximo_pago);
      const hoy = new Date();
      if (hoy > fechaPago) {
        const diferenciaMs = hoy.getTime() - fechaPago.getTime();
        diasAtraso = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
      }
    }

    return {
      '# Cartera': cliente?.numero_cartera || 'N/A',
      'Código': cliente?.codigo_consecutivo || 'N/A',
      'Cédula': cliente?.cedula || 'N/A',
      'Nombre Completo': `${cliente?.nombres || ''} ${cliente?.apellidos || ''}`.trim(),
      'Teléfono': cliente?.telefono_principal || 'N/A',
      'Barrio / Dirección': `${cliente?.barrio || ''} ${cliente?.direccion ? '- ' + cliente.direccion : ''}`.trim() || 'N/A',
      'Valor Original Crédito': Number(item.valor_credito) || 0,
      'Saldo Pendiente': Number(item.saldo_pendiente) || 0,
      'Estado': item.estado || 'N/A',
      'Días de Atraso': diasAtraso > 0 ? diasAtraso : 0,
      'Fecha Próximo Pago': item.fecha_proximo_pago ? new Date(item.fecha_proximo_pago).toLocaleDateString() : 'N/A'
    };
  });

  const hoja = XLSX.utils.json_to_sheet(datosExcel);

  hoja['!cols'] = [
    { wch: 12 }, // # Cartera
    { wch: 14 }, // Código
    { wch: 14 }, // Cédula
    { wch: 32 }, // Nombre Completo
    { wch: 14 }, // Teléfono
    { wch: 32 }, // Barrio / Dirección
    { wch: 22 }, // Valor Original Crédito
    { wch: 18 }, // Saldo Pendiente
    { wch: 12 }, // Estado
    { wch: 14 }, // Días de Atraso
    { wch: 18 }, // Fecha Próximo Pago
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Cartera Activa');

  const hoyStr = new Date().toISOString().split('T')[0];
  const nombreArchivo = `Cartera_Activa_Mercacredito_${hoyStr}.xlsx`;

  XLSX.writeFile(libro, nombreArchivo);
}

/**
 * Exporta el Directorio Completo: todos los clientes registrados en la base de datos (los 2.287).
 * Incluye sus datos demográficos, ruta asignada, estado y saldo pendiente actual si lo tienen.
 * Ordenado de forma natural por # Cartera ascendente.
 */
export async function descargarDirectorioCompletoExcel(): Promise<void> {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        id,
        codigo_consecutivo,
        numero_cartera,
        cedula,
        nombres,
        apellidos,
        telefono_principal,
        telefono_alterno,
        direccion,
        barrio,
        ciudad,
        lugar_trabajo,
        telefono_trabajo,
        estado,
        fecha_creacion,
        ruta:rutas ( nombre_ruta ),
        creditos ( saldo_pendiente, estado )
      `)
      .range(from, from + step - 1);

    if (error) {
      console.error('Error al obtener directorio de clientes:', error);
      throw new Error('No se pudo obtener el directorio completo de clientes');
    }

    allData = [...allData, ...(data || [])];

    if (data && data.length < step) {
      hasMore = false;
    } else {
      from += step;
    }
  }

  if (!allData || allData.length === 0) {
    throw new Error('No hay clientes registrados para exportar');
  }

  // Ordenar alfanuméricamente por # Cartera ascendente (igual que la vista)
  allData.sort((a, b) => compararPorNumeroCartera(a, b, 'asc'));

  // Transformar al formato Excel
  const datosExcel = allData.map((cliente: any) => {
    const ruta = Array.isArray(cliente.ruta) ? cliente.ruta[0] : cliente.ruta;
    const creditos = Array.isArray(cliente.creditos) ? cliente.creditos : [];
    
    // Suma de saldo pendiente si tiene créditos activos
    const saldoTotal = creditos.reduce(
      (acc: number, c: any) => acc + (Number(c.saldo_pendiente) || 0),
      0
    );

    const creditosActivosCount = creditos.filter(
      (c: any) => Number(c.saldo_pendiente) > 0
    ).length;

    const fechaRegistro = cliente.fecha_creacion
      ? new Date(cliente.fecha_creacion).toLocaleDateString()
      : 'N/A';

    return {
      '# Cartera': cliente.numero_cartera || 'N/A',
      'Código': cliente.codigo_consecutivo || 'N/A',
      'Cédula': cliente.cedula || 'N/A',
      'Nombre Completo': `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
      'Teléfono': cliente.telefono_principal || 'N/A',
      'Teléfono Alterno': cliente.telefono_alterno || 'N/A',
      'Ruta': ruta?.nombre_ruta || 'Sin Ruta',
      'Barrio': cliente.barrio || 'N/A',
      'Dirección': cliente.direccion || 'N/A',
      'Ciudad': cliente.ciudad || 'N/A',
      'Lugar de Trabajo': cliente.lugar_trabajo || 'N/A',
      'Teléfono Trabajo': cliente.telefono_trabajo || 'N/A',
      'Estado Cliente': cliente.estado || 'N/A',
      'Saldo Pendiente Total': saldoTotal,
      'Créditos Activos': creditosActivosCount,
      'Fecha Registro': fechaRegistro,
    };
  });

  const hoja = XLSX.utils.json_to_sheet(datosExcel);

  hoja['!cols'] = [
    { wch: 12 }, // # Cartera
    { wch: 14 }, // Código
    { wch: 14 }, // Cédula
    { wch: 32 }, // Nombre Completo
    { wch: 14 }, // Teléfono
    { wch: 16 }, // Teléfono Alterno
    { wch: 18 }, // Ruta
    { wch: 20 }, // Barrio
    { wch: 30 }, // Dirección
    { wch: 16 }, // Ciudad
    { wch: 24 }, // Lugar de Trabajo
    { wch: 16 }, // Teléfono Trabajo
    { wch: 14 }, // Estado Cliente
    { wch: 22 }, // Saldo Pendiente Total
    { wch: 16 }, // Créditos Activos
    { wch: 16 }, // Fecha Registro
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Directorio Clientes');

  const hoyStr = new Date().toISOString().split('T')[0];
  const nombreArchivo = `Directorio_Completo_Clientes_${hoyStr}.xlsx`;

  XLSX.writeFile(libro, nombreArchivo);
}

/** Alias para compatibilidad con llamadas anteriores */
export const descargarRespaldoExcel = descargarCarteraActivaExcel;
