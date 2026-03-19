import React, { useState } from 'react';
import { ArrowLeft, FileSpreadsheet, Users, Clock, DollarSign, Download, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ExcelJS from 'exceljs';

interface ReportesPersonalPageProps { onBack: () => void; }

export const ReportesPersonalPage: React.FC<ReportesPersonalPageProps> = ({ onBack }) => {
  const [generando, setGenerando] = useState<string | null>(null);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const descargar = (buffer: ArrayBuffer, nombre: string) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
  };

  const estilo = (sheet: ExcelJS.Worksheet, row: ExcelJS.Row, bg: string) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 22;
  };

  // ── Reporte Empleados ──
  const reporteEmpleados = async () => {
    setGenerando('empleados');
    try {
      const { data } = await supabase.from('empleados')
        .select('*, departamentos(nombre), puestos(nombre)')
        .order('apellidos');
      if (!data?.length) { alert('No hay empleados registrados'); return; }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Empleados');

      ws.mergeCells('A1:J1');
      const title = ws.getCell('A1');
      title.value = 'LISTA DE EMPLEADOS - CENTRO DE DIAGNÓSTICO CONRAD';
      title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312e81' } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 28;
      ws.addRow([]);

      ws.columns = [
        { key: 'codigo', width: 12 }, { key: 'nombres', width: 20 }, { key: 'apellidos', width: 20 },
        { key: 'dpi', width: 16 }, { key: 'departamento', width: 18 }, { key: 'puesto', width: 20 },
        { key: 'salario', width: 15 }, { key: 'telefono', width: 14 }, { key: 'estado', width: 12 }, { key: 'fecha', width: 14 },
      ];

      const header = ws.addRow(['Código','Nombres','Apellidos','DPI','Departamento','Puesto','Salario','Teléfono','Estado','Ingreso']);
      estilo(ws, header, 'FF4f46e5');

      data.forEach(e => {
        const row = ws.addRow([
          e.codigo_empleado, e.nombres, e.apellidos, e.dpi,
          e.departamentos?.nombre || '—', e.puestos?.nombre || '—',
          e.salario_mensual, e.telefono, e.estado,
          e.fecha_ingreso ? new Date(e.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-GT') : '—'
        ]);
        row.getCell(7).numFmt = '"Q"#,##0.00';
        if (e.estado !== 'activo') row.font = { color: { argb: 'FF9ca3af' } };
      });

      const buf = await wb.xlsx.writeBuffer();
      descargar(buf, `Empleados_CONRAD.xlsx`);
    } catch (e: any) { alert('Error: ' + e.message); }
    setGenerando(null);
  };

  // ── Reporte Nómina ──
  const reporteNomina = async () => {
    setGenerando('nomina');
    try {
      const { data } = await supabase.from('nominas')
        .select('*, empleados(codigo_empleado, nombres, apellidos, departamentos(nombre))')
        .eq('mes', mes).eq('anio', anio).order('created_at');
      if (!data?.length) { alert(`No hay nómina para ${meses[mes-1]} ${anio}`); return; }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Nómina');

      ws.mergeCells('A1:I1');
      const title = ws.getCell('A1');
      title.value = `NÓMINA ${meses[mes-1].toUpperCase()} ${anio} - CENTRO DE DIAGNÓSTICO CONRAD`;
      title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065f46' } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 28;
      ws.addRow([]);

      ws.columns = [
        { key: 'codigo', width: 12 }, { key: 'nombre', width: 28 }, { key: 'departamento', width: 18 },
        { key: 'salario', width: 15 }, { key: 'bonificacion', width: 15 }, { key: 'ingresos', width: 15 },
        { key: 'igss', width: 12 }, { key: 'deducciones', width: 15 }, { key: 'neto', width: 15 },
      ];

      const header = ws.addRow(['Código','Empleado','Departamento','Salario Base','Bonificación','Total Ingresos','IGSS','Total Deducciones','Salario Neto']);
      estilo(ws, header, 'FF059669');

      data.forEach(n => {
        const row = ws.addRow([
          n.empleados?.codigo_empleado,
          `${n.empleados?.nombres} ${n.empleados?.apellidos}`,
          n.empleados?.departamentos?.nombre || '—',
          n.salario_base, n.bonificacion, n.total_ingresos,
          n.igss, n.total_deducciones, n.salario_neto
        ]);
        ['D','E','F','G','H','I'].forEach(c => { row.getCell(c).numFmt = '"Q"#,##0.00'; });
      });

      const lastRow = ws.lastRow!.number + 2;
      ws.getCell(`H${lastRow}`).value = 'TOTAL NETO:';
      ws.getCell(`H${lastRow}`).font = { bold: true };
      const total = data.reduce((s, n) => s + n.salario_neto, 0);
      ws.getCell(`I${lastRow}`).value = total;
      ws.getCell(`I${lastRow}`).numFmt = '"Q"#,##0.00';
      ws.getCell(`I${lastRow}`).font = { bold: true };

      const buf = await wb.xlsx.writeBuffer();
      descargar(buf, `Nomina_${meses[mes-1]}_${anio}.xlsx`);
    } catch (e: any) { alert('Error: ' + e.message); }
    setGenerando(null);
  };

  // ── Reporte Asistencia ──
  const reporteAsistencia = async () => {
    setGenerando('asistencia');
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const inicio = `${anio}-${pad(mes)}-01`;
      const fin = `${anio}-${pad(mes)}-${new Date(anio, mes, 0).getDate()}`;

      const { data } = await supabase.from('asistencia')
        .select('*, empleados(codigo_empleado, nombres, apellidos)')
        .gte('fecha', inicio).lte('fecha', fin).order('fecha');
      if (!data?.length) { alert(`No hay registros de asistencia para ${meses[mes-1]} ${anio}`); return; }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Asistencia');

      ws.mergeCells('A1:G1');
      const title = ws.getCell('A1');
      title.value = `ASISTENCIA ${meses[mes-1].toUpperCase()} ${anio} - CENTRO DE DIAGNÓSTICO CONRAD`;
      title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0c2d6b' } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 28;
      ws.addRow([]);

      ws.columns = [
        { key: 'fecha', width: 14 }, { key: 'codigo', width: 12 }, { key: 'nombre', width: 28 },
        { key: 'entrada', width: 12 }, { key: 'salida', width: 12 }, { key: 'horas', width: 12 }, { key: 'estado', width: 14 },
      ];

      const header = ws.addRow(['Fecha','Código','Empleado','Entrada','Salida','Horas','Estado']);
      estilo(ws, header, 'FF1d4ed8');

      data.forEach(a => {
        ws.addRow([
          new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-GT'),
          a.empleados?.codigo_empleado,
          `${a.empleados?.nombres} ${a.empleados?.apellidos}`,
          a.hora_entrada || '—', a.hora_salida || '—',
          a.horas_trabajadas ? `${a.horas_trabajadas}h` : '—',
          a.estado || '—'
        ]);
      });

      const buf = await wb.xlsx.writeBuffer();
      descargar(buf, `Asistencia_${meses[mes-1]}_${anio}.xlsx`);
    } catch (e: any) { alert('Error: ' + e.message); }
    setGenerando(null);
  };

  const reportes = [
    { id: 'empleados', label: 'Lista de Empleados', desc: 'Directorio completo con datos, departamento, puesto y salario', icon: Users, grad: 'from-indigo-600 to-violet-600', shadow: 'shadow-indigo-200', fn: reporteEmpleados, necesitaMes: false },
    { id: 'nomina',    label: 'Nómina Mensual',     desc: 'Detalle de salarios, bonificaciones, deducciones y neto a pagar', icon: DollarSign, grad: 'from-emerald-600 to-teal-600', shadow: 'shadow-emerald-200', fn: reporteNomina, necesitaMes: true },
    { id: 'asistencia',label: 'Asistencia Mensual', desc: 'Registro de entradas, salidas y horas trabajadas por empleado', icon: Clock, grad: 'from-blue-600 to-cyan-600', shadow: 'shadow-blue-200', fn: reporteAsistencia, necesitaMes: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)'}}>
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-indigo-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 rounded-2xl p-3 border border-white/10"><FileSpreadsheet size={24} className="text-indigo-200" /></div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Reportes de Personal</h1>
              <p className="text-indigo-300 text-sm mt-0.5">Exportación de datos a Excel</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">

        {/* Selector mes/año */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-indigo-50 rounded-xl p-2"><Calendar size={14} className="text-indigo-600" /></div>
            <span className="text-sm font-black text-slate-800">Período para reportes mensuales</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Mes</label>
              <select value={mes} onChange={e => setMes(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white">
                {meses.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Año</label>
              <select value={anio} onChange={e => setAnio(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white">
                {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Reportes */}
        <div className="space-y-4">
          {reportes.map(r => {
            const Icon = r.icon;
            const cargando = generando === r.id;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 flex items-center gap-5">
                  <div className={`bg-gradient-to-br ${r.grad} rounded-2xl p-4 shadow-lg ${r.shadow} shrink-0`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                    {r.necesitaMes && (
                      <p className="text-xs text-indigo-500 font-semibold mt-1 flex items-center gap-1">
                        <Calendar size={11} /> {meses[mes-1]} {anio}
                      </p>
                    )}
                  </div>
                  <button onClick={r.fn} disabled={!!generando}
                    className={`flex items-center gap-2 bg-gradient-to-r ${r.grad} text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50 shrink-0`}>
                    {cargando
                      ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Generando...</>
                      : <><Download size={15} />Generar Excel</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-indigo-100 rounded-lg p-1.5"><FileSpreadsheet size={13} className="text-indigo-600" /></div>
            <span className="text-xs font-black text-indigo-800 uppercase tracking-wide">Información</span>
          </div>
          <ul className="space-y-1.5">
            {[
              'Los reportes se generan en formato Excel profesional (.xlsx)',
              'La lista de empleados incluye todos los registros activos e inactivos',
              'Los reportes de nómina y asistencia requieren seleccionar el período',
              'Los archivos se descargan automáticamente',
            ].map((txt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />{txt}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};