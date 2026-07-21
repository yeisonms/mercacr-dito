import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export async function descargarRespaldoExcel(): Promise<void> {
  // Consultar créditos activos (saldo > 0) haciendo JOIN con clientes
  const { data, error } = await supabase
    .from('creditos')
    .select(`
      saldo_pendiente,
      valor_credito,
      estado,
      fecha_proximo_pago,
      cliente:clientes (
        cedula,
        nombres,
        apellidos,
        telefono_principal,
        barrio,
        direccion
      )
    `)
    .gt('saldo_pendiente', 0);

  if (error) {
    console.error('Error al obtener datos para exportar:', error);
    throw new Error('No se pudo obtener la cartera de clientes');
  }

  if (!data || data.length === 0) {
    throw new Error('No hay créditos activos para exportar');
  }

  // Transformar los datos al formato deseado para el Excel
  const datosExcel = data.map((item: any) => {
    // Supabase puede devolver el cliente como array si la relación no es 1:1, aseguramos que sea un objeto
    const cliente = Array.isArray(item.cliente) ? item.cliente[0] : item.cliente;
    
    // Calcular días de atraso si está en mora (y tiene fecha de próximo pago vencida)
    let diasAtraso = 0;
    if (item.fecha_proximo_pago) {
      const fechaPago = new Date(item.fecha_proximo_pago);
      const hoy = new Date();
      // Si la fecha de pago ya pasó
      if (hoy > fechaPago) {
        const diferenciaMs = hoy.getTime() - fechaPago.getTime();
        diasAtraso = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
      }
    }

    return {
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

  // Generar el Excel
  const hoja = XLSX.utils.json_to_sheet(datosExcel);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Cartera Activa');

  // Formato del nombre: Respaldo_Cartera_Mercacredito_YYYY-MM-DD.xlsx
  const hoyStr = new Date().toISOString().split('T')[0];
  const nombreArchivo = `Respaldo_Cartera_Mercacredito_${hoyStr}.xlsx`;

  // Descargar el archivo
  XLSX.writeFile(libro, nombreArchivo);
}
