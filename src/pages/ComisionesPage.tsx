import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Calendar, DollarSign, Users, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface ComisionesPageProps {
  onBack: () => void;
}

interface MedicoComision {
  medico_id: string;
  medico_nombre: string;
  total_pacientes: number;
  comisiones_por_estudio: { [key: string]: number }; // Dinámico
  total_comision: number;
  pacientes: any[];
  seleccionado: boolean;
}

export const ComisionesPage: React.FC<ComisionesPageProps> = ({ onBack }) => {
  const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [medicos, setMedicos] = useState<MedicoComision[]>([]);
  const [loading, setLoading] = useState(false);
  const [medicoExpandido, setMedicoExpandido] = useState<string | null>(null);

  useEffect(() => {
    calcularComisiones();
  }, [fechaInicio, fechaFin]);

  const calcularComisiones = async () => {
    setLoading(true);
    try {
      // Obtener todas las consultas del período con médico asignado
      const { data: consultas, error } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(nombre, edad),
          medicos(id, nombre, es_referente),
          detalle_consultas(
            precio,
            sub_estudios(
              nombre,
              estudios(
                id,
                nombre,
                porcentaje_comision
              )
            )
          )
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .not('medico_id', 'is', null)
        .eq('sin_informacion_medico', false)
        .or('anulado.is.null,anulado.eq.false')
        .or('es_servicio_movil.is.null,es_servicio_movil.eq.false');

      if (error) throw error;

      // Agrupar por médico y calcular comisiones
      const medicoMap = new Map<string, MedicoComision>();

      consultas?.forEach(consulta => {
        // NO generar comisión si:
        // 1. tipo_cobro es 'social' o 'personalizado'
        // 2. forma_pago es 'estado_cuenta'
        // 3. es_servicio_movil es true
        // ✅ Solo médicos REFERENTES generan comisión
        if (!consulta.medicos?.es_referente) return;

        // ✅ SÍ genera: normal, especial, estado_cuenta
        // ❌ NO genera: social, personalizado, servicio_movil
        if (consulta.tipo_cobro === 'social' || 
            consulta.tipo_cobro === 'personalizado' ||
            consulta.es_servicio_movil === true ||
            consulta.sin_orden_medica === true) {
          return;
        }

        const medicoId = consulta.medico_id;
        const medicoNombre = consulta.medicos?.nombre || 'Desconocido';

        if (!medicoMap.has(medicoId)) {
          medicoMap.set(medicoId, {
            medico_id: medicoId,
            medico_nombre: medicoNombre,
            total_pacientes: 0,
            comisiones_por_estudio: {}, // Dinámico
            total_comision: 0,
            pacientes: [],
            seleccionado: true
          });
        }

        const medico = medicoMap.get(medicoId)!;
        medico.total_pacientes++;

        // ✅ Cálculo línea por línea (igual que ComisionesView)
        let totalConsulta = 0;
        let comisionTotal = 0;
        const estudiosUsados: string[] = [];

        (consulta.detalle_consultas || []).forEach((d: any) => {
          const precio = d.precio || 0;
          const estudio = d.sub_estudios?.estudios?.nombre || 'Otros';
          const pct = d.sub_estudios?.estudios?.porcentaje_comision || 0;
          const comisionLinea = precio * (pct / 100);
          totalConsulta += precio;
          comisionTotal += comisionLinea;
          estudiosUsados.push(estudio);
          if (!medico.comisiones_por_estudio[estudio]) medico.comisiones_por_estudio[estudio] = 0;
          medico.comisiones_por_estudio[estudio] += comisionLinea;
        });

        const estudioNombre = estudiosUsados[0] || 'Otros';
        const porcentaje = consulta.detalle_consultas?.[0]?.sub_estudios?.estudios?.porcentaje_comision || 0;

        medico.total_comision += comisionTotal;

        // estado_cuenta se guarda en forma_pago, no en tipo_cobro
        const etiquetaTipo = consulta.forma_pago === 'estado_cuenta'
          ? 'estado_cuenta'
          : consulta.tipo_cobro;

        medico.pacientes.push({
          nombre: consulta.pacientes?.nombre,
          fecha: consulta.fecha,
          estudios: consulta.detalle_consultas,
          tipo_cobro: etiquetaTipo,
          comision: comisionTotal,
          total: consulta.detalle_consultas?.reduce((s: number, d: any) => s + (d.precio || 0), 0) || 0,
          porcentaje,
          estudio: estudiosUsados.length > 1 ? estudiosUsados.join(' / ') : (estudiosUsados[0] || '—'),
        });
      });

      setMedicos(Array.from(medicoMap.values()).sort((a, b) => 
        b.total_comision - a.total_comision
      ));
    } catch (error) {
      console.error('Error al calcular comisiones:', error);
      alert('Error al calcular comisiones');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeleccion = (medicoId: string) => {
    setMedicos(medicos.map(m => 
      m.medico_id === medicoId ? { ...m, seleccionado: !m.seleccionado } : m
    ));
  };

  const exportarExcel = async () => {
    const medicosSeleccionados = medicos.filter(m => m.seleccionado);

    if (medicosSeleccionados.length === 0) {
      alert('Seleccione al menos un médico');
      return;
    }

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Comisiones');

    // Obtener todos los estudios únicos (dinámico)
    const estudiosUnicos = new Set<string>();
    medicosSeleccionados.forEach(m => {
      Object.keys(m.comisiones_por_estudio).forEach(estudio => {
        if (m.comisiones_por_estudio[estudio] > 0) {
          estudiosUnicos.add(estudio);
        }
      });
    });
    const estudiosArray = Array.from(estudiosUnicos).sort();

    // Título
    sheet.mergeCells('A1:' + String.fromCharCode(65 + estudiosArray.length + 1) + '1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REPORTE DE COMISIONES MÉDICAS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Período - Formatear fechas sin cambio de zona horaria
    const formatearFechaLocal = (fechaString: string) => {
      const [year, month, day] = fechaString.split('-');
      return `${day}/${month}/${year}`;
    };
    
    sheet.mergeCells('A2:' + String.fromCharCode(65 + estudiosArray.length + 1) + '2');
    const periodCell = sheet.getCell('A2');
    periodCell.value = `Período: ${formatearFechaLocal(fechaInicio)} - ${formatearFechaLocal(fechaFin)}`;
    periodCell.font = { name: 'Calibri', size: 12, bold: true };
    periodCell.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    sheet.getRow(3).height = 5;

    // Headers
    sheet.getRow(4).height = 25;
    const headers = ['Médico/Establecimiento', ...estudiosArray, 'TOTAL'];
    headers.forEach((header, idx) => {
      const cell = sheet.getCell(4, idx + 1);
      cell.value = header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF4F46E5' } },
        bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
        left: { style: 'thin', color: { argb: 'FF4F46E5' } },
        right: { style: 'thin', color: { argb: 'FF4F46E5' } }
      };
    });

    // Datos
    let row = 5;
    let totalGeneral = 0;
    const totalesPorEstudio: { [key: string]: number } = {};

    medicosSeleccionados.forEach((medico, idx) => {
      sheet.getRow(row).height = 22;
      
      // Nombre del médico
      const nombreCell = sheet.getCell(row, 1);
      nombreCell.value = medico.medico_nombre;
      nombreCell.font = { name: 'Calibri', size: 11 };
      nombreCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
      };
      nombreCell.alignment = { vertical: 'middle' };

      // Comisiones por estudio (dinámico)
      estudiosArray.forEach((estudio, eIdx) => {
        const monto = medico.comisiones_por_estudio[estudio] || 0;
        const cell = sheet.getCell(row, eIdx + 2);
        cell.value = monto;
        cell.numFmt = '"Q"#,##0.00';
        cell.font = { name: 'Calibri', size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
        };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };

        // Sumar al total del estudio
        if (!totalesPorEstudio[estudio]) totalesPorEstudio[estudio] = 0;
        totalesPorEstudio[estudio] += monto;
      });

      // Total del médico
      const totalCell = sheet.getCell(row, estudiosArray.length + 2);
      totalCell.value = medico.total_comision;
      totalCell.numFmt = '"Q"#,##0.00';
      totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF059669' } };
      totalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
      };
      totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

      totalGeneral += medico.total_comision;
      row++;
    });

    // Fila de totales
    row++;
    sheet.getRow(row).height = 28;
    
    const totalLabelCell = sheet.getCell(row, 1);
    totalLabelCell.value = 'TOTALES';
    totalLabelCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    totalLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Totales por estudio
    estudiosArray.forEach((estudio, idx) => {
      const cell = sheet.getCell(row, idx + 2);
      cell.value = totalesPorEstudio[estudio];
      cell.numFmt = '"Q"#,##0.00';
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Total general
    const totalGeneralCell = sheet.getCell(row, estudiosArray.length + 2);
    totalGeneralCell.value = totalGeneral;
    totalGeneralCell.numFmt = '"Q"#,##0.00';
    totalGeneralCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    totalGeneralCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }
    };
    totalGeneralCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Anchos de columna
    sheet.getColumn(1).width = 35;
    estudiosArray.forEach((_, idx) => {
      sheet.getColumn(idx + 2).width = 18;
    });
    sheet.getColumn(estudiosArray.length + 2).width = 18;

    // Descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Usar split para evitar problemas de zona horaria
    const [year, month] = fechaInicio.split('-');
    a.download = `Comisiones_${year}-${month}_CONRAD.xlsx`;
    a.click();
  };

  const totalComisionesSeleccionadas = medicos
    .filter(m => m.seleccionado)
    .reduce((sum, m) => sum + m.total_comision, 0);

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>

      {/* ── HEADER ── */}
      <header className="text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#3b0764 60%,#7c3aed 100%)' }}>
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2 border border-white/20">
              <DollarSign size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Comisiones Médicas</h1>
              <p className="text-purple-200 text-xs">Cálculo de comisiones por referencias</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-6xl">

        {/* ── FILTROS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                <Calendar className="inline mr-1" size={12} /> Fecha Inicio
              </label>
              <input type="date"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                <Calendar className="inline mr-1" size={12} /> Fecha Fin
              </label>
              <input type="date"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={calcularComisiones} disabled={loading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold shadow-sm shadow-purple-200 transition-all">
                {loading ? 'Calculando...' : 'Actualizar'}
              </button>
              <button onClick={exportarExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-200 transition-all">
                <Download size={15} /> Exportar Excel
              </button>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Médicos seleccionados', value: medicos.filter(m => m.seleccionado).length, icon: <Users size={18}/>, color: 'purple', text: 'text-purple-700' },
            { label: 'Total comisiones', value: `Q ${totalComisionesSeleccionadas.toFixed(2)}`, icon: <DollarSign size={18}/>, color: 'emerald', text: 'text-emerald-700' },
            { label: 'Total pacientes', value: medicos.filter(m => m.seleccionado).reduce((sum, m) => sum + m.total_pacientes, 0), icon: <Users size={18}/>, color: 'blue', text: 'text-blue-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
              <div className={`bg-${s.color}-100 rounded-xl p-2.5 text-${s.color}-600 shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                <p className={`text-2xl font-black ${s.text}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── LISTA MÉDICOS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <p className="font-black text-gray-800">Médicos con Referencias</p>
            <p className="text-xs text-gray-400 mt-0.5">Seleccione los médicos que recibirán comisión</p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-purple-600 mb-3" />
              <p className="text-gray-400 text-sm">Calculando comisiones...</p>
            </div>
          ) : medicos.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 font-medium">No se encontraron médicos con referencias en este período</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {medicos.map(medico => (
                <div key={medico.medico_id} className={`transition-colors ${medico.seleccionado ? 'bg-purple-50/40' : 'bg-white'}`}>

                  {/* Row principal */}
                  <div className="px-5 py-4 flex items-center gap-4">
                    <input type="checkbox"
                      checked={medico.seleccionado}
                      onChange={() => toggleSeleccion(medico.medico_id)}
                      className="w-4 h-4 accent-purple-600 rounded shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{medico.medico_nombre}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{medico.total_pacientes} pacientes</span>
                        {medico.pacientes.filter(p => p.tipo_cobro === 'normal').length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                            Normal: {medico.pacientes.filter(p => p.tipo_cobro === 'normal').length}
                          </span>
                        )}
                        {medico.pacientes.filter(p => p.tipo_cobro === 'especial').length > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                            Especial: {medico.pacientes.filter(p => p.tipo_cobro === 'especial').length}
                          </span>
                        )}
                        {medico.pacientes.filter(p => p.tipo_cobro === 'estado_cuenta').length > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                            Est.Cta: {medico.pacientes.filter(p => p.tipo_cobro === 'estado_cuenta').length}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-purple-700">Q {medico.total_comision.toFixed(2)}</p>
                      <button
                        onClick={() => setMedicoExpandido(medicoExpandido === medico.medico_id ? null : medico.medico_id)}
                        className="text-xs text-purple-500 hover:text-purple-700 font-semibold mt-0.5 transition-colors">
                        {medicoExpandido === medico.medico_id ? '▲ Ocultar' : '▼ Ver detalle'}
                      </button>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {medicoExpandido === medico.medico_id && (
                    <div className="px-5 pb-5 pt-1 border-t border-purple-100 bg-purple-50/30">

                      {/* Estudios */}
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-3">Comisión por estudio</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-5">
                        {Object.entries(medico.comisiones_por_estudio)
                          .filter(([_, monto]) => monto > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([estudio, monto], idx) => {
                            const colors = [
                              ['bg-blue-50 border-blue-100','text-blue-700'],
                              ['bg-emerald-50 border-emerald-100','text-emerald-700'],
                              ['bg-purple-50 border-purple-100','text-purple-700'],
                              ['bg-amber-50 border-amber-100','text-amber-700'],
                              ['bg-orange-50 border-orange-100','text-orange-700'],
                              ['bg-pink-50 border-pink-100','text-pink-700'],
                              ['bg-indigo-50 border-indigo-100','text-indigo-700'],
                              ['bg-rose-50 border-rose-100','text-rose-700'],
                            ];
                            const [bg, text] = colors[idx % colors.length];
                            return (
                              <div key={estudio} className={`${bg} border rounded-xl px-3 py-2.5`}>
                                <p className="text-xs text-gray-500 truncate" title={estudio}>{estudio}</p>
                                <p className={`font-black text-sm mt-0.5 ${text}`}>Q {monto.toFixed(2)}</p>
                              </div>
                            );
                          })}
                      </div>

                      {/* Pacientes — tabla estilo visitadoras */}
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pacientes</p>
                      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto max-h-72 overflow-y-auto">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                              <tr className="text-gray-500">
                                <th className="text-left py-2.5 px-4 font-bold">Fecha</th>
                                <th className="text-left py-2.5 px-4 font-bold">Paciente</th>
                                <th className="text-left py-2.5 px-4 font-bold">Estudio</th>
                                <th className="text-left py-2.5 px-4 font-bold">Tipo</th>
                                <th className="text-right py-2.5 px-4 font-bold">Total</th>
                                <th className="text-right py-2.5 px-4 font-bold">%</th>
                                <th className="text-right py-2.5 px-4 font-bold text-purple-600">Comisión</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {medico.pacientes.map((p, idx) => (
                                <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                                  <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                                    {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-GT')}
                                  </td>
                                  <td className="py-2.5 px-4 font-semibold text-gray-900">{p.nombre}</td>
                                  <td className="py-2.5 px-4 text-gray-600">{p.estudio || '—'}</td>
                                  <td className="py-2.5 px-4">
                                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                                      p.tipo_cobro === 'normal'        ? 'bg-blue-100 text-blue-700' :
                                      p.tipo_cobro === 'especial'      ? 'bg-purple-100 text-purple-700' :
                                      p.tipo_cobro === 'estado_cuenta' ? 'bg-amber-100 text-amber-700' :
                                      'bg-gray-100 text-gray-500'
                                    }`}>
                                      {p.tipo_cobro === 'estado_cuenta' ? 'Est. Cuenta' :
                                       p.tipo_cobro === 'especial'      ? 'Especial' :
                                       p.tipo_cobro === 'normal'        ? 'Normal' : p.tipo_cobro}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-gray-700">Q {(p.total||0).toFixed(2)}</td>
                                  <td className="py-2.5 px-4 text-right text-gray-400">{p.porcentaje || 0}%</td>
                                  <td className="py-2.5 px-4 text-right font-black text-purple-600">Q {(p.comision||0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};