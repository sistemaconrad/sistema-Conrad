/**
 * Generador de Cuadre Diario en Excel - CONRAD CENTRAL
 * Con formato profesional usando ExcelJS
 * ✅ INCLUYE: Desglose de servicios móviles
 * ✅ FIX: Sanitización de valores para evitar error XML en Excel
 */
import ExcelJS from 'exceljs';

export interface CuadreDatos {
  fecha: string;
  horaActual: string;
  totalConsultas: number;
  totalVentas: number;
  efectivoEsperado: number;
  efectivoContado: number;
  tarjetaEsperada: number;
  tarjetaContado: number;
  transferenciaEsperada: number;
  transferenciaContado: number;
  estadoCuentaEsperada?: number;
  estadoCuentaContado?: number;
  diferencias: {
    efectivo: number;
    tarjeta: number;
    depositado: number;
    estado_cuenta?: number;
  };
  cuadreCorrecto: boolean;
  observaciones?: string;
  cajero?: string;
  cuadresPorFormaPago: Array<{
    forma_pago: string;
    cantidad: number;
    total: number;
    es_servicio_movil?: boolean;
  }>;
  gastos?: Array<{
    concepto: string;
    monto: number;
    categoria?: string;
    created_at?: string;
  }>;
  preciosModificados?: Array<{
    paciente: string;
    estudio: string;
    precio_original?: number;
    precio_nuevo: number;
    justificacion: string;
  }>;
}

// ✅ Helpers para sanitizar valores antes de escribir en ExcelJS
const safeNum = (val: any): number => {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const safeStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars inválidos en XML
    .replace(/&/g, 'y')   // & puede romper XML
    .trim();
};

const borderThin = {
  top: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  left: { style: 'thin' as const },
  right: { style: 'thin' as const }
};

const borderMedium = {
  top: { style: 'medium' as const },
  bottom: { style: 'medium' as const },
  left: { style: 'medium' as const },
  right: { style: 'medium' as const }
};

// Paleta unificada — consistente con el PDF y la marca de Centro de Diagnóstico Conrad
const fillTitulo = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0F172A' } };
const fillCuadre = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0D9488' } };
const fillCuadreLight = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFCCFBF1' } };
const fillMoviles = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF9333EA' } };
const fillMovilesLight = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3E8FF' } };
const fillGastos = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD97706' } };
const fillGastosLight = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEF3C7' } };
const fillFirma = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF059669' } };
const fillOKGreen = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD1FAE5' } };
const fillErrRed = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEE2E2' } };
const fillBanda = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF8FAFC' } };

export const generarCuadreExcel = async (datos: CuadreDatos): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CONRAD';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Cuadre Diario');

  worksheet.columns = [
    { width: 5 },
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 }
  ];

  let r = 1; // fila actual

  // ===== TÍTULO =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cTitulo = worksheet.getCell(`A${r}`);
  cTitulo.value = 'CUADRE DE CAJA DIARIO - CENTRO DE DIAGNOSTICO CONRAD';
  cTitulo.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  cTitulo.fill = fillTitulo;
  cTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
  cTitulo.border = borderThin;
  worksheet.getRow(r).height = 28;
  r += 2;

  // ===== CUADRE POR FORMA DE PAGO =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cCuadre = worksheet.getCell(`A${r}`);
  cCuadre.value = 'CUADRE POR FORMA DE PAGO';
  cCuadre.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cCuadre.fill = fillCuadre;
  cCuadre.alignment = { horizontal: 'center', vertical: 'middle' };
  cCuadre.border = borderThin;
  r++;

  // Headers tabla cuadre
  ['Forma de Pago', 'Esperado', 'Contado', 'Diferencia', 'Estado'].forEach((h, i) => {
    const cell = worksheet.getCell(r, i + 2);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FF134E4A' } };
    cell.fill = fillCuadreLight;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  r++;

  const filasDatos = [
    ['Efectivo', safeNum(datos.efectivoEsperado), safeNum(datos.efectivoContado), safeNum(datos.diferencias.efectivo)],
    ['Tarjeta', safeNum(datos.tarjetaEsperada), safeNum(datos.tarjetaContado), safeNum(datos.diferencias.tarjeta)],
    ['Transferencia/Deposito', safeNum(datos.transferenciaEsperada), safeNum(datos.transferenciaContado), safeNum(datos.diferencias.depositado)]
  ] as Array<[string, number, number, number]>;

  if (safeNum(datos.estadoCuentaEsperada) > 0) {
    filasDatos.push(['Estado de Cuenta', safeNum(datos.estadoCuentaEsperada), safeNum(datos.estadoCuentaContado), safeNum(datos.diferencias.estado_cuenta)]);
  }

  filasDatos.forEach(([formaPago, esperado, contado, diferencia]) => {
    const esOK = Math.abs(diferencia) < 0.01;
    const estado = esOK ? 'OK' : 'DIFERENCIA';

    worksheet.getCell(r, 2).value = safeStr(formaPago);
    worksheet.getCell(r, 2).alignment = { horizontal: 'left' };

    worksheet.getCell(r, 3).value = esperado;
    worksheet.getCell(r, 3).numFmt = '#,##0.00';
    worksheet.getCell(r, 3).alignment = { horizontal: 'right' };

    worksheet.getCell(r, 4).value = contado;
    worksheet.getCell(r, 4).numFmt = '#,##0.00';
    worksheet.getCell(r, 4).alignment = { horizontal: 'right' };

    worksheet.getCell(r, 5).value = diferencia;
    worksheet.getCell(r, 5).numFmt = '#,##0.00';
    worksheet.getCell(r, 5).alignment = { horizontal: 'right' };
    worksheet.getCell(r, 5).font = { color: { argb: esOK ? 'FF059669' : 'FFDC2626' }, bold: true };

    worksheet.getCell(r, 6).value = estado;
    worksheet.getCell(r, 6).alignment = { horizontal: 'center' };
    worksheet.getCell(r, 6).fill = esOK ? fillOKGreen : fillErrRed;
    worksheet.getCell(r, 6).font = { bold: true };

    for (let col = 2; col <= 6; col++) {
      worksheet.getCell(r, col).border = borderThin;
    }
    r++;
  });

  // Fila TOTAL del cuadre por forma de pago
  const totalEsperadoCuadre = safeNum(datos.efectivoEsperado) + safeNum(datos.tarjetaEsperada) + safeNum(datos.transferenciaEsperada) + safeNum(datos.estadoCuentaEsperada);
  const totalContadoCuadre = safeNum(datos.efectivoContado) + safeNum(datos.tarjetaContado) + safeNum(datos.transferenciaContado) + safeNum(datos.estadoCuentaContado);
  worksheet.getCell(r, 2).value = 'TOTAL:';
  worksheet.getCell(r, 2).font = { bold: true };
  worksheet.getCell(r, 3).value = totalEsperadoCuadre;
  worksheet.getCell(r, 3).numFmt = '#,##0.00';
  worksheet.getCell(r, 3).alignment = { horizontal: 'right' };
  worksheet.getCell(r, 3).font = { bold: true };
  worksheet.getCell(r, 4).value = totalContadoCuadre;
  worksheet.getCell(r, 4).numFmt = '#,##0.00';
  worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
  worksheet.getCell(r, 4).font = { bold: true };
  for (let col = 2; col <= 6; col++) {
    worksheet.getCell(r, col).fill = fillCuadreLight;
    worksheet.getCell(r, col).border = borderThin;
  }
  r++;

  r++;

  // ===== RESULTADO FINAL =====
  worksheet.mergeCells(`B${r}:E${r}`);
  const cResultado = worksheet.getCell(`B${r}`);
  // ✅ SIN emojis/símbolos especiales que rompen el XML
  cResultado.value = datos.cuadreCorrecto ? 'CUADRE CORRECTO' : 'CUADRE CON DIFERENCIAS';
  cResultado.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cResultado.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: datos.cuadreCorrecto ? 'FF059669' : 'FFDC2626' }
  };
  cResultado.alignment = { horizontal: 'center', vertical: 'middle' };
  cResultado.border = borderMedium;
  worksheet.getRow(r).height = 25;
  r += 2;

  // ===== OBSERVACIONES =====
  if (datos.observaciones && safeStr(datos.observaciones).length > 0) {
    worksheet.mergeCells(`A${r}:F${r}`);
    const cObsH = worksheet.getCell(`A${r}`);
    cObsH.value = 'OBSERVACIONES';
    cObsH.font = { bold: true };
    cObsH.fill = fillCuadreLight;
    r++;

    worksheet.mergeCells(`B${r}:F${r}`);
    const cObs = worksheet.getCell(`B${r}`);
    cObs.value = safeStr(datos.observaciones);
    cObs.alignment = { wrapText: true, vertical: 'top' };
    r += 2;
  }

  // ===== SERVICIOS MOVILES =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cMoviles = worksheet.getCell(`A${r}`);
  cMoviles.value = 'SERVICIOS MOVILES - DETALLE POR FORMA DE PAGO';
  cMoviles.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cMoviles.fill = fillMoviles;
  cMoviles.alignment = { horizontal: 'center', vertical: 'middle' };
  cMoviles.border = borderThin;
  r++;

  ['Forma de Pago', 'Cantidad', 'Total'].forEach((h, i) => {
    const cell = worksheet.getCell(r, i + 2);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
    cell.fill = fillMovilesLight;
    cell.alignment = { horizontal: 'center' };
    cell.border = borderThin;
  });
  r++;

  const moviles = datos.cuadresPorFormaPago.filter(c => c.es_servicio_movil);
  if (moviles.length > 0) {
    moviles.forEach((m, idx) => {
      worksheet.getCell(r, 2).value = safeStr(m.forma_pago);
      worksheet.getCell(r, 3).value = safeNum(m.cantidad);
      worksheet.getCell(r, 3).alignment = { horizontal: 'center' };
      worksheet.getCell(r, 4).value = safeNum(m.total);
      worksheet.getCell(r, 4).numFmt = '#,##0.00';
      worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
      if (idx % 2 === 1) for (let col = 2; col <= 4; col++) worksheet.getCell(r, col).fill = fillBanda;
      for (let col = 2; col <= 4; col++) worksheet.getCell(r, col).border = borderThin;
      r++;
    });

    const totalMov = moviles.reduce((s, m) => s + safeNum(m.total), 0);
    worksheet.getCell(r, 2).value = 'TOTAL MOVILES:';
    worksheet.getCell(r, 2).font = { bold: true };
    worksheet.getCell(r, 4).value = totalMov;
    worksheet.getCell(r, 4).numFmt = '#,##0.00';
    worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
    worksheet.getCell(r, 4).font = { bold: true };
    for (let col = 2; col <= 4; col++) { worksheet.getCell(r, col).fill = fillMovilesLight; worksheet.getCell(r, col).border = borderThin; }
    r++;
  } else {
    worksheet.getCell(r, 2).value = 'No hay servicios moviles registrados';
    worksheet.getCell(r, 2).font = { italic: true, color: { argb: 'FF9E9E9E' } };
    r++;
  }

  // ===== GASTOS DEL DÍA =====
  r += 2;

  worksheet.mergeCells(`A${r}:F${r}`);
  const cGastosH = worksheet.getCell(`A${r}`);
  cGastosH.value = 'GASTOS DEL DIA';
  cGastosH.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cGastosH.fill = fillGastos;
  cGastosH.alignment = { horizontal: 'center', vertical: 'middle' };
  cGastosH.border = borderThin;
  r++;

  // Headers tabla gastos
  ['Concepto', 'Categoria', 'Hora', 'Monto'].forEach((h, i) => {
    const cell = worksheet.getCell(r, i + 2);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FF92400E' } };
    cell.fill = fillGastosLight;
    cell.alignment = { horizontal: 'center' };
    cell.border = borderThin;
  });
  r++;

  const gastosLista = datos.gastos || [];
  if (gastosLista.length > 0) {
    gastosLista.forEach((g, idx) => {
      let horaStr = '';
      if (g.created_at) {
        try {
          const d = new Date(g.created_at);
          horaStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        } catch { horaStr = ''; }
      }

      worksheet.getCell(r, 2).value = safeStr(g.concepto);
      worksheet.getCell(r, 2).alignment = { horizontal: 'left' };

      worksheet.getCell(r, 3).value = safeStr(g.categoria || '—');
      worksheet.getCell(r, 3).alignment = { horizontal: 'center' };

      worksheet.getCell(r, 4).value = safeStr(horaStr);
      worksheet.getCell(r, 4).alignment = { horizontal: 'center' };

      worksheet.getCell(r, 5).value = safeNum(g.monto);
      worksheet.getCell(r, 5).numFmt = '#,##0.00';
      worksheet.getCell(r, 5).alignment = { horizontal: 'right' };
      worksheet.getCell(r, 5).font = { color: { argb: 'FFC62828' } };

      if (idx % 2 === 1) for (let col = 2; col <= 5; col++) worksheet.getCell(r, col).fill = fillBanda;
      for (let col = 2; col <= 5; col++) worksheet.getCell(r, col).border = borderThin;
      r++;
    });

    // Fila total gastos
    const totalGastos = gastosLista.reduce((s, g) => s + safeNum(g.monto), 0);
    worksheet.getCell(r, 2).value = 'TOTAL GASTOS:';
    worksheet.getCell(r, 2).font = { bold: true };
    worksheet.getCell(r, 5).value = totalGastos;
    worksheet.getCell(r, 5).numFmt = '#,##0.00';
    worksheet.getCell(r, 5).alignment = { horizontal: 'right' };
    worksheet.getCell(r, 5).font = { bold: true, color: { argb: 'FFC62828' } };
    for (let col = 2; col <= 5; col++) { worksheet.getCell(r, col).fill = fillGastosLight; worksheet.getCell(r, col).border = borderThin; }
    r++;
  } else {
    worksheet.getCell(r, 2).value = 'No hay gastos registrados para este dia';
    worksheet.getCell(r, 2).font = { italic: true, color: { argb: 'FF9E9E9E' } };
    r++;
  }

  // ===== FIRMA DIGITAL =====
  if (datos.cajero) {
    r += 2;

    worksheet.mergeCells(`A${r}:F${r}`);
    const cFirmaH = worksheet.getCell(`A${r}`);
    cFirmaH.value = 'FIRMA DIGITAL';
    cFirmaH.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cFirmaH.fill = fillFirma;
    cFirmaH.alignment = { horizontal: 'center', vertical: 'middle' };
    cFirmaH.border = borderThin;
    r++;

    worksheet.getCell(`B${r}`).value = 'Cajero Responsable:';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = safeStr(datos.cajero);
    worksheet.getCell(`C${r}`).font = { bold: true, color: { argb: 'FF059669' } };

    r++;
    worksheet.getCell(`B${r}`).value = 'Fecha y Hora de Cierre:';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = safeStr(`${datos.fecha} ${datos.horaActual}`);

    r++;
    worksheet.getCell(`B${r}`).value = 'Estado:';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = 'CAJA CERRADA Y CONFIRMADA';
    worksheet.getCell(`C${r}`).font = { bold: true, color: { argb: 'FF059669' } };
  }

  // ===== MARCA DE AGUA =====
  r += 2;
  worksheet.mergeCells(`A${r}:F${r}`);
  const cWater = worksheet.getCell(`A${r}`);
  cWater.value = 'DOCUMENTO GENERADO POR CENTRO DE DIAGNOSTICO CONRAD';
  cWater.font = { name: 'Calibri', size: 9, bold: true, italic: true, color: { argb: 'FFBDBDBD' } };
  cWater.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(r).height = 18;

  // ===== DESCARGAR =====
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Cuadre_${safeStr(datos.fecha).replace(/\//g, '')}_${safeStr(datos.horaActual).replace(':', '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};