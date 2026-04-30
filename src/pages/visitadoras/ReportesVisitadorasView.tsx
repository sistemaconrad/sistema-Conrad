import React, { useState } from 'react';
import { Download, Loader } from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabase';
import { departamentosGuatemala, municipiosGuatemala } from '../../data/guatemala';

const meses = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const getNombreDepto = (id: string) => departamentosGuatemala.find(d => d.id === id)?.nombre || id;
const getNombreMun   = (id: string) => municipiosGuatemala.find(m => m.id === id)?.nombre || id;

const fechaGT = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' });
const horaGT = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: true });

// ── Columnas base de datos (igual al Excel proporcionado) ──────────
const COLS_BD = [
  'NOMBRE DEL MÉDICO/ENCARGADO',
  'CLÍNICA / FARMACIA / C.S.',
  'ESPECIALIDAD',
  'NO. DE TELÉFONO',
  'MUNICIPIO',
  'DIRECCIÓN EXACTA',
  'REFERENCIA',
  'HORARIO',
  'ESPECIAL',
  'GPS ESTABLECIMIENTO',
];

const COLS_VISITAS = [
  '#', 'FECHA', 'HORA (GT)', 'MÉDICO VISITADO', 'CLÍNICA',
  'ESPECIALIDAD', 'MUNICIPIO', 'VISITADORA', 'RECIBIDO POR', 'OBSERVACIONES',
];

export const ReportesVisitadorasView: React.FC = () => {
  const [mes,   setMes]   = useState(() => new Date().getMonth() + 1);
  const [anio,  setAnio]  = useState(() => new Date().getFullYear());
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [generando, setGenerando] = useState<string | null>(null);

  // ── helpers Excel ──────────────────────────────────────────────
  const hdr = (ws: ExcelJS.Worksheet, fila: number, cols: number, color = 'FF0D9488') => {
    const row = ws.getRow(fila);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > cols) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
    });
    row.height = 28;
  };

  const zebra = (row: ExcelJS.Row, i: number, bgArgb = 'FFFCE4EC') => {
    if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }; });
    row.eachCell(c => { c.alignment = { vertical: 'middle', wrapText: true }; c.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } }; });
  };

  const titulo = (ws: ExcelJS.Worksheet, texto: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    const c = ws.getCell('A1');
    c.value = texto;
    c.font = { bold: true, size: 13, color: { argb: 'FF0F766E' } };
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

  // ── helpers para enriquecer datos con info del médico ──────────
  const enriquecerConMedico = async (visitas: any[]) => {
    const ids = [...new Set(visitas.map(v => v.medico_id).filter(Boolean))];
    if (ids.length === 0) return visitas;
    const { data: medicos } = await supabase.from('medicos').select('id,clinica,municipio,direccion,referencia,horario,especial,lat_establecimiento,lng_establecimiento').in('id', ids);
    const map: Record<string, any> = {};
    (medicos || []).forEach(m => { map[m.id] = m; });
    return visitas.map(v => ({ ...v, _medico: map[v.medico_id] || null }));
  };

  // ── 1. BASE DE DATOS MENSUAL (hoja por visitadora) ─────────────
  const reporteBaseDatos = async (tipo: 'diario' | 'mensual') => {
    const id = tipo === 'mensual' ? 'bd-mensual' : 'bd-diario';
    setGenerando(id);
    try {
      let query = supabase.from('visitas_medicas').select('*');
      if (tipo === 'mensual') {
        query = query
          .gte('created_at', `${periodoInicio()}T06:00:00.000Z`)
          .lt('created_at', new Date(new Date(`${periodoFin()}T06:00:00.000Z`).getTime() + 86400000).toISOString());
      } else {
        query = query
          .gte('created_at', `${fecha}T06:00:00.000Z`)
          .lt('created_at', new Date(new Date(`${fecha}T06:00:00.000Z`).getTime() + 86400000).toISOString());
      }
      const { data, error } = await query.order('visitadora_nombre').order('created_at');
      if (error) throw error;

      const visitas = await enriquecerConMedico(data || []);
      const wb = new ExcelJS.Workbook();
      const cols = COLS_VISITAS.length;

      // Agrupar por visitadora
      const porVisitadora: Record<string, any[]> = {};
      visitas.forEach(v => {
        const key = v.visitadora_nombre || 'Sin asignar';
        if (!porVisitadora[key]) porVisitadora[key] = [];
        porVisitadora[key].push(v);
      });

      // Si no hay datos, crear hoja vacía
      if (Object.keys(porVisitadora).length === 0) {
        const ws = wb.addWorksheet('Sin visitas');
        titulo(ws, `SIN VISITAS REGISTRADAS — ${tipo === 'mensual' ? periodoLabel().toUpperCase() : fecha}`, cols);
      }

      // Hoja por visitadora
      Object.entries(porVisitadora).forEach(([visitadora, items]) => {
        // Nombre hoja máximo 31 chars (límite Excel)
        const nombreHoja = visitadora.length > 28 ? visitadora.substring(0, 28) + '...' : visitadora;
        const ws = wb.addWorksheet(nombreHoja);

        const tituloTexto = tipo === 'mensual'
          ? `VISITAS MÉDICAS — ${periodoLabel().toUpperCase()} — ${visitadora.toUpperCase()}`
          : `VISITAS DEL DÍA ${fecha} — ${visitadora.toUpperCase()}`;

        titulo(ws, tituloTexto, cols);
        subtitulo(ws, `Total: ${items.length} visita${items.length !== 1 ? 's' : ''}`, cols);
        ws.addRow(COLS_VISITAS);
        hdr(ws, 4, cols);

        items.forEach((v, i) => {
          const m = v._medico;
          const gps = m?.lat_establecimiento
            ? `${m.lat_establecimiento.toFixed(6)}, ${m.lng_establecimiento?.toFixed(6)}`
            : '—';
          const r = ws.addRow([
            i + 1,
            fechaGT(v.created_at),
            horaGT(v.created_at),
            v.medico_nombre || '—',
            m?.clinica || '—',
            v.medico_especialidad || '—',
            m ? getNombreMun(m.municipio) : '—',
            v.visitadora_nombre || '—',
            v.nombre_receptor || '—',
            v.comentario || '—',
          ]);
          zebra(r, i);
          r.height = 26;
        });

        [5, 14, 12, 28, 22, 18, 16, 22, 22, 40].forEach((w, i) => {
          ws.getColumn(i + 1).width = w;
        });
      });

      // Hoja resumen (solo mensual)
      if (tipo === 'mensual' && Object.keys(porVisitadora).length > 0) {
        const wsRes = wb.addWorksheet('RESUMEN');
        titulo(wsRes, `RESUMEN GENERAL — ${periodoLabel().toUpperCase()}`, 3);
        subtitulo(wsRes, `${visitas.length} visitas totales`, 3);
        wsRes.addRow(['VISITADORA', 'VISITAS', '% DEL TOTAL']);
        hdr(wsRes, 4, 3, 'FF880E4F');
        const total = visitas.length;
        Object.entries(porVisitadora)
          .sort((a, b) => b[1].length - a[1].length)
          .forEach(([vis, items], i) => {
            const r = wsRes.addRow([vis, items.length, `${Math.round((items.length / total) * 100)}%`]);
            zebra(r, i, 'FFFCE4EC');
            r.getCell(2).font = { bold: true };
          });
        wsRes.addRow([]);
        const tr = wsRes.addRow(['TOTAL', total, '100%']);
        tr.eachCell(c => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF880E4F' } };
        });
        [35, 12, 12].forEach((w, i) => wsRes.getColumn(i + 1).width = w);
        // Mover resumen al inicio
        wb.moveSheet('RESUMEN', 0);
      }

      const nombre = tipo === 'mensual'
        ? `Visitas_${meses[mes - 1]}_${anio}.xlsx`
        : `Visitas_${fecha}.xlsx`;
      await descargar(wb, nombre);
    } catch (e) {
      console.error(e);
      alert('Error al generar el reporte.');
    }
    setGenerando(null);
  };

  // ── 2. DIRECTORIO (Base de datos estilo Excel entregado) ───────
  const reporteDirectorio = async () => {
    setGenerando('directorio');
    try {
      const { data, error } = await supabase.from('medicos').select('*').eq('activo', true).order('nombre');
      if (error) throw error;

      const wb = new ExcelJS.Workbook();
      const cols = COLS_BD.length;

      // Hoja referentes
      const wsRef = wb.addWorksheet('MÉDICOS REFERENTES');
      titulo(wsRef, 'DIRECTORIO MÉDICOS REFERENTES — HOSPITAL SAN ÁNGEL / CONRAD', cols);
      subtitulo(wsRef, `${(data || []).filter(m => m.es_referente).length} médicos referentes activos`, cols);
      wsRef.addRow(COLS_BD);
      hdr(wsRef, 4, cols, 'FF880E4F');
      (data || []).filter(m => m.es_referente).forEach((m, i) => {
        const gps = m.lat_establecimiento ? `${m.lat_establecimiento.toFixed(6)}, ${m.lng_establecimiento?.toFixed(6)}` : '';
        const r = wsRef.addRow([
          m.nombre || '',
          m.clinica || '',
          m.especialidad || '',
          m.telefono || '',
          getNombreMun(m.municipio),
          m.direccion || '',
          m.referencia || '',
          m.horario || '',
          m.especial || '',
          gps,
        ]);
        zebra(r, i, 'FFFCE4EC');
        r.height = 24;
      });
      [30, 25, 20, 16, 18, 35, 35, 18, 25, 28].forEach((w, idx) => wsRef.getColumn(idx + 1).width = w);

      // Hoja prospectos
      const wsProsp = wb.addWorksheet('PROSPECTOS');
      titulo(wsProsp, 'DIRECTORIO DE PROSPECTOS — HOSPITAL SAN ÁNGEL / CONRAD', cols);
      subtitulo(wsProsp, `${(data || []).filter(m => !m.es_referente).length} prospectos activos`, cols);
      wsProsp.addRow(COLS_BD);
      hdr(wsProsp, 4, cols, 'FFEF6C00');
      (data || []).filter(m => !m.es_referente).forEach((m, i) => {
        const gps = m.lat_establecimiento ? `${m.lat_establecimiento.toFixed(6)}, ${m.lng_establecimiento?.toFixed(6)}` : '';
        const r = wsProsp.addRow([
          m.nombre || '',
          m.clinica || '',
          m.especialidad || '',
          m.telefono || '',
          getNombreMun(m.municipio),
          m.direccion || '',
          m.referencia || '',
          m.horario || '',
          m.especial || '',
          gps,
        ]);
        zebra(r, i, 'FFFFF3E0');
        r.height = 24;
      });
      [30, 25, 20, 16, 18, 35, 35, 18, 25, 28].forEach((w, idx) => wsProsp.getColumn(idx + 1).width = w);

      await descargar(wb, `Directorio_Medicos_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Error al generar el directorio.');
    }
    setGenerando(null);
  };

  // ── 3. REPORTE COMISIONES (igual que antes) ────────────────────
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

      const map: { [k: string]: { nombre: string; consultas: number; total: number; comision: number } } = {};
      const detalle: any[] = [];
      (consultas || []).forEach((c: any) => {
        if (!c.medico_id || !c.medicos) return;
        if (!c.medicos.es_referente) return;
        if (c.tipo_cobro === 'social' || c.tipo_cobro === 'personalizado') return;
        if (c.es_servicio_movil || c.sin_informacion_medico || c.sin_orden_medica) return;
        let total = 0, com = 0;
        const estudios: string[] = [];
        (c.detalle_consultas || []).forEach((d: any) => {
          const precio = d.precio || 0;
          const pct = d.sub_estudios?.estudios?.porcentaje_comision || 0;
          total += precio; com += precio * pct / 100;
          estudios.push(d.sub_estudios?.estudios?.nombre || 'Otros');
        });
        const estudio = estudios[0] || 'Otros';
        const pct = c.detalle_consultas?.[0]?.sub_estudios?.estudios?.porcentaje_comision || 0;
        const etiquetaTipo = c.forma_pago === 'estado_cuenta' ? 'Estado Cuenta' : c.tipo_cobro === 'especial' ? 'Especial' : 'Normal';
        if (!map[c.medico_id]) map[c.medico_id] = { nombre: c.medicos.nombre, consultas: 0, total: 0, comision: 0 };
        map[c.medico_id].consultas++; map[c.medico_id].total += total; map[c.medico_id].comision += com;
        detalle.push({ fecha: c.fecha, medico: c.medicos.nombre, paciente: c.pacientes?.nombre || '—', tipo: etiquetaTipo, estudio, total, pct, com });
      });
      const lista = Object.values(map).sort((a, b) => b.comision - a.comision);
      const wb = new ExcelJS.Workbook();
      const ws1 = wb.addWorksheet('Resumen');
      titulo(ws1, `COMISIONES MÉDICOS REFERENTES — ${periodoLabel().toUpperCase()}`, 5);
      subtitulo(ws1, `${lista.length} médicos con comisión`, 5);
      ws1.addRow(['#', 'Médico', 'Consultas', 'Total Generado (Q)', 'Comisión (Q)']);
      hdr(ws1, 4, 5, 'FF1B5E20');
      let sumT = 0, sumC = 0;
      lista.forEach((m, i) => {
        sumT += m.total; sumC += m.comision;
        const r = ws1.addRow([i + 1, `Dr. ${m.nombre}`, m.consultas, +m.total.toFixed(2), +m.comision.toFixed(2)]);
        if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }; });
        r.getCell(4).numFmt = '#,##0.00'; r.getCell(5).numFmt = '#,##0.00';
        r.getCell(5).font = { bold: true, color: { argb: 'FF1B5E20' } };
      });
      ws1.addRow([]);
      const tr = ws1.addRow(['', 'TOTALES', lista.reduce((s, m) => s + m.consultas, 0), +sumT.toFixed(2), +sumC.toFixed(2)]);
      tr.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }; });
      tr.getCell(4).numFmt = '#,##0.00'; tr.getCell(5).numFmt = '#,##0.00';
      [5, 30, 14, 22, 22].forEach((w, i) => ws1.getColumn(i + 1).width = w);
      const ws2 = wb.addWorksheet('Detalle');
      titulo(ws2, `DETALLE DE CONSULTAS — ${periodoLabel().toUpperCase()}`, 8);
      subtitulo(ws2, `${detalle.length} consultas con comisión`, 8);
      ws2.addRow(['Fecha', 'Médico', 'Paciente', 'Tipo Cobro', 'Estudio', 'Total (Q)', '%', 'Comisión (Q)']);
      hdr(ws2, 4, 8, 'FF1B5E20');
      detalle.forEach((d, i) => {
        const [y, m, dd] = d.fecha.split('-');
        const r = ws2.addRow([`${dd}/${m}/${y}`, `Dr. ${d.medico}`, d.paciente, d.tipo, d.estudio, +d.total.toFixed(2), `${d.pct}%`, +d.com.toFixed(2)]);
        if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }; });
        r.getCell(6).numFmt = '#,##0.00'; r.getCell(8).numFmt = '#,##0.00';
        r.getCell(8).font = { bold: true, color: { argb: 'FF1B5E20' } };
      });
      [14, 28, 24, 14, 20, 16, 8, 16].forEach((w, i) => ws2.getColumn(i + 1).width = w);
      await descargar(wb, `Comisiones_${meses[mes - 1]}_${anio}.xlsx`);
    } catch (e) { console.error(e); alert('Error al generar reporte de comisiones.'); }
    setGenerando(null);
  };

  // ── UI ────────────────────────────────────────────────────────
  const SelectorMes = () => (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <select value={mes} onChange={e => setMes(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-400">
        {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select value={anio} onChange={e => setAnio(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-400">
        {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <span className="text-xs text-gray-400 font-medium">{periodoLabel()}</span>
    </div>
  );

  const BtnDescargar = ({ id, onClick, label = 'Descargar Excel' }: { id: string; onClick: () => void; label?: string }) => (
    <button onClick={onClick} disabled={generando !== null}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors mt-4">
      {generando === id ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
      {generando === id ? 'Generando...' : label}
    </button>
  );

  const reportes = [
    {
      id: 'bd-mensual',
      emoji: '📊',
      titulo: 'Visitas Mensual',
      desc: 'Una hoja por visitadora + resumen general. Columnas: médico, clínica, especialidad, municipio, visitadora, receptor, observaciones.',
      color: 'from-teal-600 to-cyan-700',
      controls: <SelectorMes />,
      fn: () => reporteBaseDatos('mensual'),
    },
    {
      id: 'bd-diario',
      emoji: '📅',
      titulo: 'Visitas del Día',
      desc: 'Visitas de un día específico organizadas por visitadora. Mismo formato que el mensual.',
      color: 'from-indigo-500 to-blue-600',
      controls: (
        <div className="mb-4">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 w-full" />
        </div>
      ),
      fn: () => reporteBaseDatos('diario'),
    },
    {
      id: 'directorio',
      emoji: '🗂️',
      titulo: 'Directorio de Médicos',
      desc: 'Base de datos completa con las columnas del directorio oficial: nombre, clínica, especialidad, teléfono, municipio, dirección, referencia, horario, especial y GPS.',
      color: 'from-purple-500 to-violet-600',
      controls: <p className="text-xs text-gray-400 mb-4">Incluye hojas separadas: Médicos Referentes y Prospectos.</p>,
      fn: reporteDirectorio,
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
