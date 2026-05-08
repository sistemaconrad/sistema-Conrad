/**
 * Generador de Reportes de Gastos - CONRAD CENTRAL
 * Reporte diario y unificado mensual para administración
 */
import ExcelJS from 'exceljs';
import { supabase } from '../lib/supabase';

interface Gasto {
  id: string;
  fecha: string;
  created_at: string;
  concepto: string;
  monto: number;
  proveedor?: string;
  forma_pago?: string;
  numero_factura?: string;
  observaciones?: string;
  nombre_usuario?: string;
  categorias_gastos?: {
    nombre: string;
  };
}

const CATEGORIAS_ORDEN = [
  'Combustible',
  'Demandas',
  'Equipo',
  'Gastos Dr R',
  'Gastos Dr E',
  'Honorarios profesionales',
  'Insumos básicos',
  'Insumos médicos',
  'Mantenimiento/Reparaciones',
  'Mobiliario y equipo',
  'Papelería',
  'Préstamos',
  'Publicidad',
  'Reembolsos',
  'Servicios básicos',
  'Sueldos',
  'Transporte',
  'Total general',
];

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

const VERDE_OSCURO = '1A5276';
const VERDE_MEDIO  = '1E8449';
const GRIS_HEADER  = 'D5D8DC';
const NARANJA      = 'E67E22';

function getColumnLetter(n: number): string {
  let l = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    l = String.fromCharCode(65 + r) + l;
    n = Math.floor((n - 1) / 26);
  }
  return l;
}

function headerCell(cell: ExcelJS.Cell, value: string, bgArgb = VERDE_OSCURO) {
  cell.value = value;
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgArgb } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  };
}

function dataCell(cell: ExcelJS.Cell, value: any, align: 'left'|'center'|'right' = 'left', bold = false, color?: string) {
  cell.value = value;
  cell.font = { name: 'Calibri', size: 10, bold, ...(color ? { color: { argb: 'FF' + color } } : {}) };
  cell.alignment = { horizontal: align, vertical: 'middle' };
  cell.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  };
  if (typeof value === 'number') cell.numFmt = '#,##0.00';
}

function totalCell(cell: ExcelJS.Cell, value: number) {
  cell.value = value;
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_MEDIO } };
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  cell.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  };
  cell.numFmt = '#,##0.00';
}

// ─────────────────────────────────────────────
// REPORTE DIARIO
// ─────────────────────────────────────────────
export async function generarReporteGastosDiario(fecha: string): Promise<void> {
  const { data: gastosRaw, error } = await supabase
    .from('gastos')
    .select('*, categorias_gastos(nombre)')
    .eq('fecha', fecha)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const gastos: Gasto[] = gastosRaw || [];
  const [yyyy, mm, dd] = fecha.split('-');
  const fechaDisplay = `${dd}/${mm}/${yyyy}`;
  const nombreMes = MESES[parseInt(mm) - 1];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`GASTOS ${dd}-${mm}-${yyyy.slice(-2)}`);

  ws.columns = [
    { width: 5 },   // No.
    { width: 22 },  // Categoría
    { width: 30 },  // Concepto
    { width: 14 },  // Monto
    { width: 16 },  // Proveedor
    { width: 14 },  // Forma pago
    { width: 14 },  // No. Factura
    { width: 18 },  // Anotado por
    { width: 24 },  // Observaciones
  ];

  // Fila 1 – Título
  ws.mergeCells('A1:D1');
  ws.mergeCells('E1:I1');
  const cFecha = ws.getCell('A1');
  cFecha.value = `GASTOS DEL DÍA: ${fechaDisplay}`;
  cFecha.font = { name: 'Calibri', size: 12, bold: true };
  cFecha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5D8DC' } };
  cFecha.alignment = { horizontal: 'left', vertical: 'middle' };
  cFecha.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  ws.getRow(1).height = 22;

  const cConrad = ws.getCell('E1');
  cConrad.value = 'CONRAD CENTRAL';
  cConrad.font = { name: 'Calibri', size: 14, bold: true };
  cConrad.alignment = { horizontal: 'center', vertical: 'middle' };
  cConrad.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };

  // Fila 2 – Headers
  ws.getRow(2).height = 22;
  const headers = ['No.', 'CATEGORÍA', 'CONCEPTO', 'MONTO', 'PROVEEDOR', 'FORMA PAGO', 'NO. FACTURA', 'ANOTADO POR', 'OBSERVACIONES'];
  headers.forEach((h, i) => headerCell(ws.getCell(2, i + 1), h));

  // Filas de datos
  let fila = 3;
  let totalDia = 0;

  if (gastos.length === 0) {
    ws.mergeCells(`A${fila}:I${fila}`);
    const c = ws.getCell(`A${fila}`);
    c.value = 'Sin gastos registrados para este día';
    c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF888888' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    fila++;
  } else {
    gastos.forEach((g, idx) => {
      const cat = g.categorias_gastos?.nombre || '—';
      const esNoCategoria = !g.categorias_gastos;
      totalDia += g.monto;

      const altFill = idx % 2 === 1 ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF2F5F9' } } : undefined;

      const applyAlt = (cell: ExcelJS.Cell) => { if (altFill) cell.fill = altFill; };

      dataCell(ws.getCell(fila, 1), idx + 1, 'center'); applyAlt(ws.getCell(fila, 1));
      dataCell(ws.getCell(fila, 2), cat.toUpperCase(), 'left', false, esNoCategoria ? NARANJA : undefined); applyAlt(ws.getCell(fila, 2));
      dataCell(ws.getCell(fila, 3), g.concepto?.toUpperCase() || ''); applyAlt(ws.getCell(fila, 3));
      dataCell(ws.getCell(fila, 4), g.monto, 'right'); applyAlt(ws.getCell(fila, 4));
      dataCell(ws.getCell(fila, 5), (g.proveedor || '').toUpperCase()); applyAlt(ws.getCell(fila, 5));
      dataCell(ws.getCell(fila, 6), (g.forma_pago || '').toUpperCase()); applyAlt(ws.getCell(fila, 6));
      dataCell(ws.getCell(fila, 7), g.numero_factura || '', 'center'); applyAlt(ws.getCell(fila, 7));
      dataCell(ws.getCell(fila, 8), (g.nombre_usuario || '').toUpperCase()); applyAlt(ws.getCell(fila, 8));
      dataCell(ws.getCell(fila, 9), g.observaciones || ''); applyAlt(ws.getCell(fila, 9));

      ws.getRow(fila).height = 18;
      fila++;
    });
  }

  // Fila total
  fila++;
  ws.mergeCells(`A${fila}:C${fila}`);
  const cTotalLabel = ws.getCell(`A${fila}`);
  cTotalLabel.value = 'TOTAL DEL DÍA';
  cTotalLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_OSCURO } };
  cTotalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  cTotalLabel.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  ws.getRow(fila).height = 22;
  totalCell(ws.getCell(fila, 4), totalDia);
  for (let c = 5; c <= 9; c++) {
    ws.getCell(fila, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_OSCURO } };
    ws.getCell(fila, c).border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  }

  // Resumen por categoría
  fila += 2;
  ws.mergeCells(`A${fila}:D${fila}`);
  const cResLabel = ws.getCell(`A${fila}`);
  cResLabel.value = 'RESUMEN POR CATEGORÍA';
  cResLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cResLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_OSCURO } };
  cResLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  cResLabel.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  ws.getRow(fila).height = 20;
  fila++;

  headerCell(ws.getCell(fila, 1), 'CATEGORÍA', VERDE_OSCURO);
  ws.mergeCells(`A${fila}:C${fila}`);
  headerCell(ws.getCell(fila, 1), 'CATEGORÍA', VERDE_OSCURO);
  headerCell(ws.getCell(fila, 4), 'TOTAL', VERDE_OSCURO);
  ws.getRow(fila).height = 18;
  fila++;

  const totalesPorCat: Record<string, number> = {};
  gastos.forEach(g => {
    const cat = g.categorias_gastos?.nombre || 'Sin categoría';
    totalesPorCat[cat] = (totalesPorCat[cat] || 0) + g.monto;
  });

  let totalGeneral = 0;
  CATEGORIAS_ORDEN.forEach((cat, idx) => {
    if (!totalesPorCat[cat]) return;
    const monto = totalesPorCat[cat];
    totalGeneral += monto;
    const altFill = idx % 2 === 1 ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF2F5F9' } } : undefined;
    ws.mergeCells(`A${fila}:C${fila}`);
    dataCell(ws.getCell(`A${fila}`), cat.toUpperCase());
    if (altFill) ws.getCell(`A${fila}`).fill = altFill;
    dataCell(ws.getCell(fila, 4), monto, 'right');
    if (altFill) ws.getCell(fila, 4).fill = altFill;
    ws.getRow(fila).height = 18;
    fila++;
  });

  // Categorías no estándar
  Object.entries(totalesPorCat).forEach(([cat, monto]) => {
    if (CATEGORIAS_ORDEN.includes(cat)) return;
    totalGeneral += monto;
    ws.mergeCells(`A${fila}:C${fila}`);
    dataCell(ws.getCell(`A${fila}`), cat.toUpperCase(), 'left', false, NARANJA);
    dataCell(ws.getCell(fila, 4), monto, 'right');
    ws.getRow(fila).height = 18;
    fila++;
  });

  ws.mergeCells(`A${fila}:C${fila}`);
  const cTotCat = ws.getCell(`A${fila}`);
  cTotCat.value = 'TOTAL GENERAL';
  cTotCat.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cTotCat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_MEDIO } };
  cTotCat.alignment = { horizontal: 'right', vertical: 'middle' };
  cTotCat.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  totalCell(ws.getCell(fila, 4), totalGeneral);
  ws.getRow(fila).height = 20;

  await descargarExcel(wb, `GASTOS_${dd}-${mm}-${yyyy}.xlsx`);
}

// ─────────────────────────────────────────────
// REPORTE MENSUAL UNIFICADO
// ─────────────────────────────────────────────
export async function generarReporteGastosMensual(mes: number, anio: number): Promise<void> {
  const primerDia = `${anio}-${mes.toString().padStart(2,'0')}-01`;
  const ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];

  const { data: gastosRaw, error } = await supabase
    .from('gastos')
    .select('*, categorias_gastos(nombre)')
    .gte('fecha', primerDia)
    .lte('fecha', ultimoDia)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  const gastos: Gasto[] = gastosRaw || [];
  const nombreMes = MESES[mes - 1];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('GASTOS MENSUALES');

  ws.columns = [
    { width: 5 },   // No.
    { width: 12 },  // Fecha
    { width: 22 },  // Categoría
    { width: 30 },  // Concepto
    { width: 14 },  // Monto
    { width: 16 },  // Proveedor
    { width: 14 },  // Forma pago
    { width: 14 },  // No. Factura
    { width: 18 },  // Anotado por
    { width: 24 },  // Observaciones
  ];

  // Título
  ws.mergeCells('A1:E1');
  ws.mergeCells('F1:J1');
  const cTit = ws.getCell('A1');
  cTit.value = `REPORTE DE GASTOS — ${nombreMes} ${anio}`;
  cTit.font = { name: 'Calibri', size: 12, bold: true };
  cTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5D8DC' } };
  cTit.alignment = { horizontal: 'left', vertical: 'middle' };
  cTit.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  ws.getRow(1).height = 22;

  const cConrad = ws.getCell('F1');
  cConrad.value = 'CONRAD CENTRAL';
  cConrad.font = { name: 'Calibri', size: 14, bold: true };
  cConrad.alignment = { horizontal: 'center', vertical: 'middle' };
  cConrad.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };

  // Headers
  ws.getRow(2).height = 22;
  ['No.','FECHA','CATEGORÍA','CONCEPTO','MONTO','PROVEEDOR','FORMA PAGO','NO. FACTURA','ANOTADO POR','OBSERVACIONES']
    .forEach((h, i) => headerCell(ws.getCell(2, i + 1), h));

  let fila = 3;
  let totalMes = 0;

  if (gastos.length === 0) {
    ws.mergeCells(`A${fila}:J${fila}`);
    const c = ws.getCell(`A${fila}`);
    c.value = 'Sin gastos registrados para este mes';
    c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF888888' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    fila++;
  } else {
    gastos.forEach((g, idx) => {
      const cat = g.categorias_gastos?.nombre || '—';
      const esNoCategoria = !g.categorias_gastos;
      totalMes += g.monto;

      const [y, m, d] = g.fecha.split('-');
      const fechaDisplay = `${d}/${m}/${y}`;

      const altFill = idx % 2 === 1 ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF2F5F9' } } : undefined;
      const applyAlt = (cell: ExcelJS.Cell) => { if (altFill) cell.fill = altFill; };

      dataCell(ws.getCell(fila, 1), idx + 1, 'center'); applyAlt(ws.getCell(fila, 1));
      dataCell(ws.getCell(fila, 2), fechaDisplay, 'center'); applyAlt(ws.getCell(fila, 2));
      dataCell(ws.getCell(fila, 3), cat.toUpperCase(), 'left', false, esNoCategoria ? NARANJA : undefined); applyAlt(ws.getCell(fila, 3));
      dataCell(ws.getCell(fila, 4), g.concepto?.toUpperCase() || ''); applyAlt(ws.getCell(fila, 4));
      dataCell(ws.getCell(fila, 5), g.monto, 'right'); applyAlt(ws.getCell(fila, 5));
      dataCell(ws.getCell(fila, 6), (g.proveedor || '').toUpperCase()); applyAlt(ws.getCell(fila, 6));
      dataCell(ws.getCell(fila, 7), (g.forma_pago || '').toUpperCase()); applyAlt(ws.getCell(fila, 7));
      dataCell(ws.getCell(fila, 8), g.numero_factura || '', 'center'); applyAlt(ws.getCell(fila, 8));
      dataCell(ws.getCell(fila, 9), (g.nombre_usuario || '').toUpperCase()); applyAlt(ws.getCell(fila, 9));
      dataCell(ws.getCell(fila, 10), g.observaciones || ''); applyAlt(ws.getCell(fila, 10));

      ws.getRow(fila).height = 18;
      fila++;
    });
  }

  // Total mes
  fila++;
  ws.mergeCells(`A${fila}:D${fila}`);
  const cTotalLabel = ws.getCell(`A${fila}`);
  cTotalLabel.value = 'TOTAL DEL MES';
  cTotalLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_OSCURO } };
  cTotalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  cTotalLabel.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  ws.getRow(fila).height = 22;
  totalCell(ws.getCell(fila, 5), totalMes);
  for (let c = 6; c <= 10; c++) {
    ws.getCell(fila, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_OSCURO } };
    ws.getCell(fila, c).border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  }

  // Resumen por categoría
  fila += 2;
  ws.mergeCells(`A${fila}:E${fila}`);
  const cResLabel = ws.getCell(`A${fila}`);
  cResLabel.value = 'RESUMEN POR CATEGORÍA — ' + nombreMes + ' ' + anio;
  cResLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cResLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_OSCURO } };
  cResLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  cResLabel.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  ws.getRow(fila).height = 20;
  fila++;

  ws.mergeCells(`A${fila}:D${fila}`);
  headerCell(ws.getCell(`A${fila}`), 'CATEGORÍA', VERDE_OSCURO);
  headerCell(ws.getCell(fila, 5), 'TOTAL', VERDE_OSCURO);
  ws.getRow(fila).height = 18;
  fila++;

  const totalesPorCat: Record<string, number> = {};
  gastos.forEach(g => {
    const cat = g.categorias_gastos?.nombre || 'Sin categoría';
    totalesPorCat[cat] = (totalesPorCat[cat] || 0) + g.monto;
  });

  let totalGeneral = 0;
  CATEGORIAS_ORDEN.forEach((cat, idx) => {
    if (!totalesPorCat[cat]) return;
    const monto = totalesPorCat[cat];
    totalGeneral += monto;
    const altFill = idx % 2 === 1 ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF2F5F9' } } : undefined;
    ws.mergeCells(`A${fila}:D${fila}`);
    dataCell(ws.getCell(`A${fila}`), cat.toUpperCase());
    if (altFill) ws.getCell(`A${fila}`).fill = altFill;
    dataCell(ws.getCell(fila, 5), monto, 'right');
    if (altFill) ws.getCell(fila, 5).fill = altFill;
    ws.getRow(fila).height = 18;
    fila++;
  });

  Object.entries(totalesPorCat).forEach(([cat, monto]) => {
    if (CATEGORIAS_ORDEN.includes(cat)) return;
    totalGeneral += monto;
    ws.mergeCells(`A${fila}:D${fila}`);
    dataCell(ws.getCell(`A${fila}`), cat.toUpperCase(), 'left', false, NARANJA);
    dataCell(ws.getCell(fila, 5), monto, 'right');
    ws.getRow(fila).height = 18;
    fila++;
  });

  ws.mergeCells(`A${fila}:D${fila}`);
  const cTotCat = ws.getCell(`A${fila}`);
  cTotCat.value = 'TOTAL GENERAL';
  cTotCat.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cTotCat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE_MEDIO } };
  cTotCat.alignment = { horizontal: 'right', vertical: 'middle' };
  cTotCat.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  totalCell(ws.getCell(fila, 5), totalGeneral);
  ws.getRow(fila).height = 20;

  await descargarExcel(wb, `GASTOS_${nombreMes}_${anio}.xlsx`);
}

async function descargarExcel(wb: ExcelJS.Workbook, nombre: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}