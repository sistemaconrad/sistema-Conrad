/**
 * Generador de Cuadre Diario en Excel - CONRAD CENTRAL
 * Con formato profesional usando ExcelJS
 * ✅ INCLUYE: Desglose de servicios móviles
 * ✅ FIX: Sanitización de valores para evitar error XML en Excel
 */
import ExcelJS from 'exceljs';

interface CuadreDatos {
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

const fillBlue = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } };
const fillLightBlue = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF5B9BD5' } };
const fillLightBlue2 = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } };
const fillGreen = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF70AD47' } };
const fillPurple = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF7B1FA2' } };
const fillLightPurple = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE1BEE7' } };
const fillOKGreen = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFC6EFCE' } };
const fillErrRed = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFC7CE' } };

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
  cTitulo.value = 'CUADRE DE CAJA DIARIO - CONRAD';
  cTitulo.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  cTitulo.fill = fillBlue;
  cTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
  cTitulo.border = borderThin;
  worksheet.getRow(r).height = 25;
  r++;

  // ===== INFO GENERAL =====
  r++;
  worksheet.getCell(`B${r}`).value = 'Fecha';
  worksheet.getCell(`B${r}`).font = { bold: true };
  worksheet.getCell(`C${r}`).value = safeStr(datos.fecha);

  r++;
  worksheet.getCell(`B${r}`).value = 'Hora de Cuadre';
  worksheet.getCell(`B${r}`).font = { bold: true };
  worksheet.getCell(`C${r}`).value = safeStr(datos.horaActual);

  if (datos.cajero) {
    r++;
    worksheet.getCell(`B${r}`).value = 'Cajero';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = safeStr(datos.cajero);
  }

  r += 2;

  // ===== RESUMEN =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cResumen = worksheet.getCell(`A${r}`);
  cResumen.value = 'RESUMEN';
  cResumen.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cResumen.fill = fillBlue;
  cResumen.alignment = { horizontal: 'center', vertical: 'middle' };
  cResumen.border = borderThin;
  r++;

  worksheet.getCell(`B${r}`).value = 'Total Consultas (Regulares + Moviles)';
  worksheet.getCell(`B${r}`).font = { bold: true };
  worksheet.getCell(`C${r}`).value = safeNum(datos.totalConsultas);
  worksheet.getCell(`C${r}`).alignment = { horizontal: 'center' };
  r++;

  worksheet.getCell(`B${r}`).value = 'Total Ventas';
  worksheet.getCell(`B${r}`).font = { bold: true };
  worksheet.getCell(`C${r}`).value = safeNum(datos.totalVentas);
  worksheet.getCell(`C${r}`).numFmt = '#,##0.00';
  worksheet.getCell(`C${r}`).alignment = { horizontal: 'center' };
  r += 2;

  // ===== CUADRE POR FORMA DE PAGO =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cCuadre = worksheet.getCell(`A${r}`);
  cCuadre.value = 'CUADRE POR FORMA DE PAGO';
  cCuadre.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cCuadre.fill = fillBlue;
  cCuadre.alignment = { horizontal: 'center', vertical: 'middle' };
  cCuadre.border = borderThin;
  r++;

  // Headers tabla cuadre
  ['Forma de Pago', 'Esperado', 'Contado', 'Diferencia', 'Estado'].forEach((h, i) => {
    const cell = worksheet.getCell(r, i + 2);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fillLightBlue;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  r++;

  const filasDatos = [
    ['Efectivo', safeNum(datos.efectivoEsperado), safeNum(datos.efectivoContado), safeNum(datos.diferencias.efectivo)],
    ['Tarjeta', safeNum(datos.tarjetaEsperada), safeNum(datos.tarjetaContado), safeNum(datos.diferencias.tarjeta)],
    ['Transferencia', safeNum(datos.transferenciaEsperada), safeNum(datos.transferenciaContado), safeNum(datos.diferencias.depositado)]
  ] as Array<[string, number, number, number]>;

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
    worksheet.getCell(r, 5).font = { color: { argb: esOK ? 'FF008000' : 'FFFF0000' }, bold: true };

    worksheet.getCell(r, 6).value = estado;
    worksheet.getCell(r, 6).alignment = { horizontal: 'center' };
    worksheet.getCell(r, 6).fill = esOK ? fillOKGreen : fillErrRed;
    worksheet.getCell(r, 6).font = { bold: true };

    for (let col = 2; col <= 6; col++) {
      worksheet.getCell(r, col).border = borderThin;
    }
    r++;
  });

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
    fgColor: { argb: datos.cuadreCorrecto ? 'FF70AD47' : 'FFFF0000' }
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
    cObsH.fill = fillLightBlue2;
    r++;

    worksheet.mergeCells(`B${r}:F${r}`);
    const cObs = worksheet.getCell(`B${r}`);
    cObs.value = safeStr(datos.observaciones);
    cObs.alignment = { wrapText: true, vertical: 'top' };
    r += 2;
  }

  // ===== CONSULTAS REGULARES =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cDetalle = worksheet.getCell(`A${r}`);
  cDetalle.value = 'CONSULTAS REGULARES - DETALLE POR FORMA DE PAGO';
  cDetalle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cDetalle.fill = fillBlue;
  cDetalle.alignment = { horizontal: 'center', vertical: 'middle' };
  cDetalle.border = borderThin;
  r++;

  ['Forma de Pago', 'Cantidad', 'Total'].forEach((h, i) => {
    const cell = worksheet.getCell(r, i + 2);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = fillLightBlue2;
    cell.alignment = { horizontal: 'center' };
    cell.border = borderThin;
  });
  r++;

  const regulares = datos.cuadresPorFormaPago.filter(c => !c.es_servicio_movil);
  if (regulares.length > 0) {
    regulares.forEach(c => {
      worksheet.getCell(r, 2).value = safeStr(c.forma_pago);
      worksheet.getCell(r, 3).value = safeNum(c.cantidad);
      worksheet.getCell(r, 3).alignment = { horizontal: 'center' };
      worksheet.getCell(r, 4).value = safeNum(c.total);
      worksheet.getCell(r, 4).numFmt = '#,##0.00';
      worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
      for (let col = 2; col <= 4; col++) worksheet.getCell(r, col).border = borderThin;
      r++;
    });

    const totalReg = regulares.reduce((s, c) => s + safeNum(c.total), 0);
    worksheet.getCell(r, 2).value = 'TOTAL REGULARES:';
    worksheet.getCell(r, 2).font = { bold: true };
    worksheet.getCell(r, 4).value = totalReg;
    worksheet.getCell(r, 4).numFmt = '#,##0.00';
    worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
    worksheet.getCell(r, 4).font = { bold: true };
    worksheet.getCell(r, 4).fill = fillLightBlue2;
    r++;
  } else {
    worksheet.getCell(r, 2).value = 'No hay consultas regulares';
    worksheet.getCell(r, 2).font = { italic: true, color: { argb: 'FF9E9E9E' } };
    r++;
  }

  r += 2;

  // ===== SERVICIOS MOVILES =====
  worksheet.mergeCells(`A${r}:F${r}`);
  const cMoviles = worksheet.getCell(`A${r}`);
  cMoviles.value = 'SERVICIOS MOVILES - DETALLE POR FORMA DE PAGO';
  cMoviles.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cMoviles.fill = fillPurple;
  cMoviles.alignment = { horizontal: 'center', vertical: 'middle' };
  cMoviles.border = borderThin;
  r++;

  ['Forma de Pago', 'Cantidad', 'Total'].forEach((h, i) => {
    const cell = worksheet.getCell(r, i + 2);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = fillLightPurple;
    cell.alignment = { horizontal: 'center' };
    cell.border = borderThin;
  });
  r++;

  const moviles = datos.cuadresPorFormaPago.filter(c => c.es_servicio_movil);
  if (moviles.length > 0) {
    moviles.forEach(m => {
      worksheet.getCell(r, 2).value = safeStr(m.forma_pago);
      worksheet.getCell(r, 3).value = safeNum(m.cantidad);
      worksheet.getCell(r, 3).alignment = { horizontal: 'center' };
      worksheet.getCell(r, 4).value = safeNum(m.total);
      worksheet.getCell(r, 4).numFmt = '#,##0.00';
      worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
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
    worksheet.getCell(r, 4).fill = fillLightPurple;
    r++;
  } else {
    worksheet.getCell(r, 2).value = 'No hay servicios moviles registrados';
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
    cFirmaH.fill = fillGreen;
    cFirmaH.alignment = { horizontal: 'center', vertical: 'middle' };
    cFirmaH.border = borderThin;
    r++;

    worksheet.getCell(`B${r}`).value = 'Cajero Responsable:';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = safeStr(datos.cajero);
    worksheet.getCell(`C${r}`).font = { bold: true, color: { argb: 'FF70AD47' } };

    r++;
    worksheet.getCell(`B${r}`).value = 'Fecha y Hora de Cierre:';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = safeStr(`${datos.fecha} ${datos.horaActual}`);

    r++;
    worksheet.getCell(`B${r}`).value = 'Estado:';
    worksheet.getCell(`B${r}`).font = { bold: true };
    worksheet.getCell(`C${r}`).value = 'CAJA CERRADA Y CONFIRMADA';
    worksheet.getCell(`C${r}`).font = { bold: true, color: { argb: 'FF70AD47' } };
  }

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
