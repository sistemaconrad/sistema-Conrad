import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DatosCuadreQuincenal {
  consultasPorMedico: { [medico: string]: any[] };
  mes: string;
  anio: number;
  quincena: 1 | 2;
  fechaInicio: Date;
  fechaFin: Date;
}

export const generarCuadreQuincenal = async (datos: DatosCuadreQuincenal) => {
  const workbook = new ExcelJS.Workbook();
  
  // Crear una hoja por cada médico
  for (const [medico, consultas] of Object.entries(datos.consultasPorMedico)) {
    // Nombre de hoja limpio (Excel no permite ciertos caracteres)
    const nombreHoja = medico.substring(0, 30).replace(/[:\\/?*\[\]]/g, '');
    const worksheet = workbook.addWorksheet(nombreHoja);

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 25 }, // Nombre paciente
      { width: 12 }, // Fecha
      { width: 30 }, // Estudio
      { width: 12 }  // Monto
    ];

    let currentRow = 1;

    // LOGO (espacio para imagen - simulado con texto)
    const logoRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const logoCell = worksheet.getCell(currentRow, 1);
    logoCell.value = 'CONRAD';
    logoCell.font = { size: 18, bold: true, color: { argb: 'FF1e5180' } };
    logoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    logoRow.height = 30;
    currentRow++;

    // Subtítulo
    const subtituloRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const subtituloCell = worksheet.getCell(currentRow, 1);
    subtituloCell.value = 'Centro de Diagnóstico';
    subtituloCell.font = { size: 10, color: { argb: 'FF666666' } };
    subtituloCell.alignment = { horizontal: 'center' };
    currentRow++;

    // Espacio
    currentRow++;

    // Título del cuadre
    const tituloRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const tituloCell = worksheet.getCell(currentRow, 1);
    tituloCell.value = `ESTADO DE CUENTA ${datos.quincena === 1 ? 'PRIMERA' : 'SEGUNDA'} QUINCENA`;
    tituloCell.font = { size: 14, bold: true };
    tituloCell.alignment = { horizontal: 'center' };
    tituloCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD6EAF8' } // Azul claro
    };
    tituloRow.height = 25;
    currentRow++;

    // Médico nombre
    const medicoRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const medicoCell = worksheet.getCell(currentRow, 1);
    medicoCell.value = medico.toUpperCase();
    medicoCell.font = { size: 12, bold: true, color: { argb: 'FF1e5180' } };
    medicoCell.alignment = { horizontal: 'center' };
    currentRow++;

    // Mes
    const mesRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const mesCell = worksheet.getCell(currentRow, 1);
    mesCell.value = `${datos.mes.toUpperCase()} ${datos.anio}`;
    mesCell.font = { size: 11, bold: true };
    mesCell.alignment = { horizontal: 'center' };
    currentRow++;

    // Espacio
    currentRow++;

    // Headers de la tabla
    const headerRow = worksheet.getRow(currentRow);
    const headers = ['NOMBRE DEL PACIENTE', 'FECHA', 'ESTUDIO', 'Q'];
    
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E75B6' } // Azul
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    headerRow.height = 20;
    currentRow++;

    // Datos
    let totalGeneral = 0;
    consultas.forEach(consulta => {
      const pacienteNombre = consulta.pacientes?.nombre || 'Sin nombre';
      const fecha = format(new Date(consulta.fecha), 'dd/MM/yy');
      
      // ✅ CAMBIO PRINCIPAL: Obtener estudios desde detalle_consultas
      const detalles = consulta.detalle_consultas || [];
      const estudiosTexto = detalles
        .map((detalle: any) => detalle.sub_estudios?.nombre || 'Estudio')
        .join(', ');
      const totalConsulta = detalles.reduce((sum: number, detalle: any) => sum + (detalle.precio || 0), 0);

      // Determinar si es inhábil (fin de semana)
      const fechaObj = new Date(consulta.fecha);
      const esInhabil = fechaObj.getDay() === 0 || fechaObj.getDay() === 6;

      const dataRow = worksheet.getRow(currentRow);
      
      // Nombre
      const nombreCell = dataRow.getCell(1);
      nombreCell.value = pacienteNombre;
      nombreCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Fecha
      const fechaCell = dataRow.getCell(2);
      fechaCell.value = fecha;
      fechaCell.alignment = { horizontal: 'center' };
      fechaCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Estudio (con indicador INHABIL si aplica)
      const estudioCell = dataRow.getCell(3);
      estudioCell.value = esInhabil ? `${estudiosTexto}   INHABIL` : estudiosTexto;
      if (esInhabil) {
        estudioCell.font = { color: { argb: 'FFFF0000' } }; // Rojo
      }
      estudioCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Monto
      const montoCell = dataRow.getCell(4);
      montoCell.value = totalConsulta;
      montoCell.numFmt = 'Q#,##0.00';
      montoCell.alignment = { horizontal: 'right' };
      montoCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      totalGeneral += totalConsulta;
      currentRow++;
    });

    // Espacio
    currentRow++;

    // Total
    const totalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    const totalLabelCell = worksheet.getCell(currentRow, 1);
    totalLabelCell.value = 'TOTAL';
    totalLabelCell.font = { bold: true };
    totalLabelCell.alignment = { horizontal: 'right' };
    totalLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' } // Verde
    };
    totalLabelCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    const totalValueCell = totalRow.getCell(4);
    totalValueCell.value = totalGeneral;
    totalValueCell.numFmt = 'Q#,##0.00';
    totalValueCell.font = { bold: true };
    totalValueCell.alignment = { horizontal: 'right' };
    totalValueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' } // Verde
    };
    totalValueCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }

  // Generar archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Cuadre_Quincenal_${datos.quincena}Q_${datos.mes}_${datos.anio}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

// ============================================================
// REPORTE DE SERVICIOS MÓVILES QUINCENAL
// Mismo formato que el quincenal normal, solo cambia título y archivo
// ============================================================
export const generarCuadreQuincenalMoviles = async (datos: DatosCuadreQuincenal) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CONRAD';

  for (const [medico, consultas] of Object.entries(datos.consultasPorMedico)) {
    const nombreHoja = medico.substring(0, 30).replace(/[:\\/?*[\]]/g, '');
    const worksheet = workbook.addWorksheet(nombreHoja);

    worksheet.columns = [
      { width: 25 },
      { width: 12 },
      { width: 30 },
      { width: 12 }
    ];

    let currentRow = 1;

    // LOGO
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const logoCell = worksheet.getCell(currentRow, 1);
    logoCell.value = 'CONRAD';
    logoCell.font = { size: 18, bold: true, color: { argb: 'FF1e5180' } };
    logoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 30;
    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const subtCell = worksheet.getCell(currentRow, 1);
    subtCell.value = 'Centro de Diagnostico';
    subtCell.font = { size: 10, color: { argb: 'FF666666' } };
    subtCell.alignment = { horizontal: 'center' };
    currentRow++;
    currentRow++;

    // Título — diferencia clave: dice SERVICIOS MOVILES
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const tituloCell = worksheet.getCell(currentRow, 1);
    tituloCell.value = `SERVICIOS MOVILES - ESTADO DE CUENTA ${datos.quincena === 1 ? 'PRIMERA' : 'SEGUNDA'} QUINCENA`;
    tituloCell.font = { size: 14, bold: true };
    tituloCell.alignment = { horizontal: 'center' };
    tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAF8' } };
    worksheet.getRow(currentRow).height = 25;
    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const medicoCell = worksheet.getCell(currentRow, 1);
    medicoCell.value = medico.toUpperCase();
    medicoCell.font = { size: 12, bold: true, color: { argb: 'FF1e5180' } };
    medicoCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const mesCell = worksheet.getCell(currentRow, 1);
    mesCell.value = `${datos.mes.toUpperCase()} ${datos.anio}`;
    mesCell.font = { size: 11, bold: true };
    mesCell.alignment = { horizontal: 'center' };
    currentRow++;
    currentRow++;

    // Headers
    const headers = ['NOMBRE DEL PACIENTE', 'FECHA', 'ESTUDIO', 'Q'];
    const headerRow = worksheet.getRow(currentRow);
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 20;
    currentRow++;

    // Datos
    let totalGeneral = 0;
    consultas.forEach(consulta => {
      const pacienteNombre = consulta.pacientes?.nombre || 'Sin nombre';
      const fecha = format(new Date(consulta.fecha), 'dd/MM/yy');
      const detalles = consulta.detalle_consultas || [];
      const estudiosTexto = detalles.map((d: any) => d.sub_estudios?.nombre || 'Estudio').join(', ');
      const totalConsulta = detalles.reduce((sum: number, d: any) => sum + (d.precio || 0), 0);
      const fechaObj = new Date(consulta.fecha);
      const esInhabil = fechaObj.getDay() === 0 || fechaObj.getDay() === 6;

      const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
      const dataRow = worksheet.getRow(currentRow);

      const c1 = dataRow.getCell(1); c1.value = pacienteNombre; c1.border = border;
      const c2 = dataRow.getCell(2); c2.value = fecha; c2.alignment = { horizontal: 'center' }; c2.border = border;
      const c3 = dataRow.getCell(3);
      c3.value = esInhabil ? `${estudiosTexto}   INHABIL` : estudiosTexto;
      if (esInhabil) c3.font = { color: { argb: 'FFFF0000' } };
      c3.border = border;
      const c4 = dataRow.getCell(4);
      c4.value = totalConsulta; c4.numFmt = 'Q#,##0.00'; c4.alignment = { horizontal: 'right' }; c4.border = border;

      totalGeneral += totalConsulta;
      currentRow++;
    });

    currentRow++;

    // Total
    const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const fillVerde = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF92D050' } };

    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    const totalLabel = worksheet.getCell(currentRow, 1);
    totalLabel.value = 'TOTAL'; totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right' }; totalLabel.fill = fillVerde; totalLabel.border = border;

    const totalVal = worksheet.getCell(currentRow, 4);
    totalVal.value = totalGeneral; totalVal.numFmt = 'Q#,##0.00';
    totalVal.font = { bold: true }; totalVal.alignment = { horizontal: 'right' };
    totalVal.fill = fillVerde; totalVal.border = border;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Servicios_Moviles_${datos.quincena}Q_${datos.mes}_${datos.anio}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};