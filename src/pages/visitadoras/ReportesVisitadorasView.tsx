import React, { useState } from 'react';
import { Download, Loader } from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabase';

const meses = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

// Hora local Guatemala (UTC-6)
const toGT = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - 6 * 60 * 60 * 1000);
};
const fechaGT = (iso: string) => toGT(iso).toLocaleDateString('es-GT');
const horaGT  = (iso: string) => toGT(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

export const ReportesVisitadorasView: React.FC = () => {
  const [mes,   setMes]   = useState(() => new Date().getMonth() + 1);
  const [anio,  setAnio]  = useState(() => new Date().getFullYear());
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [generando, setGenerando] = useState<string | null>(null);

  // ── helpers Excel ──────────────────────────────────────────────
  const hdr = (ws: ExcelJS.Worksheet, fila: number, cols: number, color = 'FFE91E63') => {
    const row = ws.getRow(fila);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > cols) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    row.height = 22;
  };

  const zebra = (row: ExcelJS.Row, i: number, bgArgb = 'FFFCE4EC') => {
    if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }; });
    row.eachCell(c => { c.alignment = { vertical: 'middle' }; c.border = { bottom: { style: 'hair', color: { argb: 'FFDDD' } } }; });
  };

  const titulo = (ws: ExcelJS.Worksheet, texto: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    const c = ws.getCell('A1');
    c.value = texto;
    c.font = { bold: true, size: 13, color: { argb: 'FFC2185B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;
  };

  const subtitulo = (ws: ExcelJS.Worksheet, texto: string, cols: number) => {
    ws.mergeCells(2, 1, 2, cols);
    const c = ws.getCell('A2');
    c.value = texto;
    c.font = { italic: true, size: 10, color: { argb: 'FF888888' } };
    c.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 18;
    ws.addRow([]);
  };

  const descargar = async (wb: ExcelJS.Workbook, nombre: string) => {
    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  };

  const periodoLabel = () => `${meses[mes - 1]} ${anio}`;
  const periodoInicio = () => `${anio}-${String(mes).padStart(2, '0')}-01`;
  const periodoFin    = () => { const d = new Date(anio, mes, 0).getDate(); return `${anio}-${String(mes).padStart(2, '0')}-${d}`; };

  // ── 1. VISITAS MENSUAL ─────────────────────────────────────────
  const reporteVisitasMensual = async () => {
    setGenerando('visitas-mes');
    try {
      const { data, error } = await supabase.from('visitas_medicas').select('*')
        .gte('created_at', `${periodoInicio()}T00:00:00`)
        .lte('created_at', `${periodoFin()}T23:59:59`)
        .order('created_at');
      if (error) throw error;

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Visitas ${meses[mes-1]} ${anio}`);
      const cols = 8;
      titulo(ws, `REPORTE DE VISITAS MÉDICAS — ${meses[mes-1].toUpperCase()} ${anio}`, cols);
      subtitulo(ws, `Total de visitas: ${data?.length || 0}`, cols);
      ws.addRow(['#','Fecha','Hora (GT)','Médico Visitado','Especialidad','Visitadora','Receptor','Comentario']);
      hdr(ws, 4, cols);
      (data || []).forEach((v: any, i) => {
        const r = ws.addRow([i+1, fechaGT(v.created_at), horaGT(v.created_at), v.medico_nombre, v.medico_especialidad||'—', v.visitadora_nombre, v.nombre_receptor||'—', v.comentario||'—']);
        zebra(r, i);
      });
      [5,14,12,28,18,22,22,40].forEach((w,i) => ws.getColumn(i+1).width = w);
      await descargar(wb, `Visitas_${meses[mes-1]}_${anio}.xlsx`);
    } catch(e) { console.error(e); alert('Error al generar reporte de visitas.'); }
    setGenerando(null);
  };

  // ── 2. VISITAS DIARIO ─────────────────────────────────────────
  const reporteVisitasDiario = async () => {
    setGenerando('visitas-dia');
    try {
      const { data, error } = await supabase.from('visitas_medicas').select('*')
        .gte('created_at', `${fecha}T00:00:00`)
        .lte('created_at', `${fecha}T23:59:59`)
        .order('created_at');
      if (error) throw error;

      const [y,m,d] = fecha.split('-');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Visitas ${d}-${m}-${y}`);
      const cols = 7;
      titulo(ws, `REPORTE DIARIO DE VISITAS — ${d}/${m}/${y}`, cols);
      subtitulo(ws, `Total de visitas: ${data?.length || 0}`, cols);
      ws.addRow(['#','Hora (GT)','Médico Visitado','Especialidad','Visitadora','Receptor','Comentario']);
      hdr(ws, 4, cols);
      (data || []).forEach((v: any, i) => {
        const r = ws.addRow([i+1, horaGT(v.created_at), v.medico_nombre, v.medico_especialidad||'—', v.visitadora_nombre, v.nombre_receptor||'—', v.comentario||'—']);
        zebra(r, i);
      });
      [5,12,28,18,22,22,40].forEach((w,i) => ws.getColumn(i+1).width = w);
      await descargar(wb, `Visitas_${d}-${m}-${y}.xlsx`);
    } catch(e) { console.error(e); alert('Error al generar reporte diario.'); }
    setGenerando(null);
  };

  // ── 3. DIRECTORIO MÉDICOS ─────────────────────────────────────
  const reporteMedicos = async () => {
    setGenerando('medicos');
    try {
      const { data, error } = await supabase.from('medicos').select('*').eq('es_referente', true).eq('activo', true).order('nombre');
      if (error) throw error;

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Médicos Referentes');
      const cols = 7;
      titulo(ws, 'DIRECTORIO DE MÉDICOS REFERENTES', cols);
      subtitulo(ws, `Total: ${data?.length || 0} médicos activos`, cols);
      ws.addRow(['#','Nombre','Especialidad','Teléfono','Departamento','Municipio','Dirección']);
      hdr(ws, 4, cols, 'FF7B1FA2');
      (data || []).forEach((m: any, i) => {
        const r = ws.addRow([i+1, m.nombre, m.especialidad||'—', m.telefono, m.departamento, m.municipio, m.direccion]);
        if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } }; });
        r.eachCell(c => { c.alignment = { vertical: 'middle' }; });
      });
      [5,28,20,14,18,18,35].forEach((w,i) => ws.getColumn(i+1).width = w);
      await descargar(wb, `Medicos_Referentes.xlsx`);
    } catch(e) { console.error(e); alert('Error al generar directorio.'); }
    setGenerando(null);
  };

  // ── 4. COMISIONES ─────────────────────────────────────────────
  const reporteComisiones = async () => {
    setGenerando('comisiones');
    try {
      const { data: consultas, error } = await supabase.from('consultas').select(`
        id, fecha, tipo_cobro, medico_id, forma_pago, es_servicio_movil, sin_informacion_medico, sin_orden_medica,
        pacientes(nombre),
        medicos(nombre, es_referente),
        detalle_consultas(precio, sub_estudios(nombre, estudios(nombre, porcentaje_comision)))
      `)
      .not('medico_id', 'is', null)
      .gte('fecha', periodoInicio())
      .lte('fecha', periodoFin())
      .or('anulado.is.null,anulado.eq.false')
      .order('fecha');
      if (error) throw error;

      // Agrupar por médico con porcentaje variable
      const map: { [k: string]: { nombre: string; consultas: number; total: number; comision: number } } = {};
      const detalle: any[] = [];

      (consultas || []).forEach((c: any) => {
        // ✅ Mismas reglas que ComisionesView
        if (!c.medico_id || !c.medicos) return;
        if (!c.medicos.es_referente) return;
        if (c.tipo_cobro === 'social' || c.tipo_cobro === 'personalizado') return;
        if (c.es_servicio_movil || c.sin_informacion_medico || c.sin_orden_medica) return;

        // ✅ Cálculo línea por línea
        let total = 0, com = 0;
        const estudios: string[] = [];
        (c.detalle_consultas || []).forEach((d: any) => {
          const precio = d.precio || 0;
          const pct = d.sub_estudios?.estudios?.porcentaje_comision || 0;
          total += precio;
          com += precio * pct / 100;
          estudios.push(d.sub_estudios?.estudios?.nombre || 'Otros');
        });

        const estudio = estudios[0] || 'Otros';
        const pct = c.detalle_consultas?.[0]?.sub_estudios?.estudios?.porcentaje_comision || 0;
        // ✅ estado_cuenta va en forma_pago
        const etiquetaTipo = c.forma_pago === 'estado_cuenta' ? 'Estado Cuenta'
          : c.tipo_cobro === 'especial' ? 'Especial' : 'Normal';

        if (!map[c.medico_id]) map[c.medico_id] = { nombre: c.medicos.nombre, consultas: 0, total: 0, comision: 0 };
        map[c.medico_id].consultas++;
        map[c.medico_id].total += total;
        map[c.medico_id].comision += com;
        detalle.push({ fecha: c.fecha, medico: c.medicos.nombre, paciente: c.pacientes?.nombre||'—', tipo: etiquetaTipo, estudio, total, pct, com });
      });

      const lista = Object.values(map).sort((a,b) => b.comision - a.comision);

      const wb = new ExcelJS.Workbook();

      // Hoja resumen
      const ws1 = wb.addWorksheet('Resumen');
      titulo(ws1, `COMISIONES MÉDICOS REFERENTES — ${periodoLabel().toUpperCase()}`, 5);
      subtitulo(ws1, `${lista.length} médicos con comisión`, 5);
      ws1.addRow(['#','Médico','Consultas','Total Generado (Q)','Comisión (Q)']);
      hdr(ws1, 4, 5, 'FF1B5E20');
      let sumT = 0, sumC = 0;
      lista.forEach((m, i) => {
        sumT += m.total; sumC += m.comision;
        const r = ws1.addRow([i+1, `Dr. ${m.nombre}`, m.consultas, +m.total.toFixed(2), +m.comision.toFixed(2)]);
        if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }; });
        r.getCell(4).numFmt = '#,##0.00'; r.getCell(5).numFmt = '#,##0.00';
        r.getCell(5).font = { bold: true, color: { argb: 'FF1B5E20' } };
      });
      ws1.addRow([]);
      const tr = ws1.addRow(['','TOTALES', lista.reduce((s,m)=>s+m.consultas,0), +sumT.toFixed(2), +sumC.toFixed(2)]);
      tr.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }; });
      tr.getCell(4).numFmt = '#,##0.00'; tr.getCell(5).numFmt = '#,##0.00';
      [5,30,14,22,22].forEach((w,i) => ws1.getColumn(i+1).width = w);

      // Hoja detalle
      const ws2 = wb.addWorksheet('Detalle');
      titulo(ws2, `DETALLE DE CONSULTAS — ${periodoLabel().toUpperCase()}`, 7);
      subtitulo(ws2, `${detalle.length} consultas con comisión`, 7);
      ws2.addRow(['Fecha','Médico','Paciente','Tipo Cobro','Estudio','Total (Q)','%','Comisión (Q)']);
      hdr(ws2, 4, 8, 'FF1B5E20');
      detalle.forEach((d, i) => {
        const [y,m,dd] = d.fecha.split('-');
        const r = ws2.addRow([`${dd}/${m}/${y}`, `Dr. ${d.medico}`, d.paciente, d.tipo, d.estudio, +d.total.toFixed(2), `${d.pct}%`, +d.com.toFixed(2)]);
        if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }; });
        r.getCell(6).numFmt = '#,##0.00'; r.getCell(8).numFmt = '#,##0.00';
        r.getCell(8).font = { bold: true, color: { argb: 'FF1B5E20' } };
      });
      [14,28,24,14,20,16,8,16].forEach((w,i) => ws2.getColumn(i+1).width = w);

      await descargar(wb, `Comisiones_${meses[mes-1]}_${anio}.xlsx`);
    } catch(e) { console.error(e); alert('Error al generar reporte de comisiones.'); }
    setGenerando(null);
  };

  // ── UI ────────────────────────────────────────────────────────
  const SelectorMes = () => (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <select value={mes} onChange={e => setMes(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400">
        {meses.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
      </select>
      <select value={anio} onChange={e => setAnio(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400">
        {[2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <span className="text-xs text-gray-400 font-medium">{periodoLabel()}</span>
    </div>
  );

  const BtnDescargar = ({ id, onClick }: { id: string; onClick: () => void }) => (
    <button onClick={onClick} disabled={generando !== null}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors mt-4">
      {generando === id ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
      {generando === id ? 'Generando...' : 'Descargar Excel'}
    </button>
  );

  const reportes = [
    {
      id: 'visitas-mes',
      emoji: '🗺️',
      titulo: 'Visitas Mensual',
      desc: 'Todas las visitas del mes con fecha, hora Guatemala, médico y receptor.',
      color: 'from-blue-500 to-indigo-600',
      controls: <SelectorMes />,
      fn: reporteVisitasMensual,
    },
    {
      id: 'visitas-dia',
      emoji: '📅',
      titulo: 'Visitas del Día',
      desc: 'Visitas de un día específico con hora local Guatemala.',
      color: 'from-pink-500 to-rose-600',
      controls: (
        <div className="mb-4">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400 w-full" />
        </div>
      ),
      fn: reporteVisitasDiario,
    },
    {
      id: 'medicos',
      emoji: '🩺',
      titulo: 'Directorio de Médicos',
      desc: 'Listado completo de médicos referentes con contacto y ubicación.',
      color: 'from-purple-500 to-violet-600',
      controls: <p className="text-xs text-gray-400 mb-4">Sin filtro de período — exporta todos los médicos activos.</p>,
      fn: reporteMedicos,
    },
    {
      id: 'comisiones',
      emoji: '💰',
      titulo: 'Reporte de Comisiones',
      desc: 'Comisiones por médico referente con porcentaje variable por estudio. Incluye resumen y detalle.',
      color: 'from-green-500 to-emerald-600',
      controls: <SelectorMes />,
      fn: reporteComisiones,
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {reportes.map(r => (
        <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className={`bg-gradient-to-r ${r.color} p-5 text-white`}>
            <p className="text-3xl mb-2">{r.emoji}</p>
            <p className="font-bold text-lg leading-tight">{r.titulo}</p>
            <p className="text-white/70 text-sm mt-1">{r.desc}</p>
          </div>
          <div className="p-5 flex flex-col flex-1">
            {r.controls}
            <BtnDescargar id={r.id} onClick={r.fn} />
          </div>
        </div>
      ))}
    </div>
  );
};