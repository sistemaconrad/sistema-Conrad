import React, { useState } from 'react';
import { ArrowLeft, FileSpreadsheet, Download, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks';
import { generarReporteExcel, generarReporteMoviles, generarReporteMensualUnificado, generarReporteMensualMoviles } from '../utils/excel-generator';

interface ReportesPageProps {
  onBack: () => void;
}

export const ReportesPage: React.FC<ReportesPageProps> = ({ onBack }) => {
  // ✅ CORREGIDO: Obtener fecha/mes/año en zona horaria de Guatemala (GMT-6)
  const getGuatemalaDate = () => {
    const ahora = new Date();
    const guatemalaTime = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    return guatemalaTime;
  };

  const getFechaGuatemala = () => {
    const gt = getGuatemalaDate();
    const yyyy = gt.getFullYear();
    const mm = String(gt.getMonth() + 1).padStart(2, '0');
    const dd = String(gt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [generando, setGenerando] = useState(false);
  const [tipoReporte, setTipoReporte] = useState<'dia' | 'mes'>('dia');

  // ✅ CORREGIDO: Inicializar con fecha de Guatemala
  const [fechaUnica, setFechaUnica] = useState(getFechaGuatemala());
  const [mes, setMes] = useState(getGuatemalaDate().getMonth() + 1);
  const [anio, setAnio] = useState(getGuatemalaDate().getFullYear());

  const { toast, showToast, hideToast } = useToast();

  const meses = [
    { value: 1,  label: 'Enero' },
    { value: 2,  label: 'Febrero' },
    { value: 3,  label: 'Marzo' },
    { value: 4,  label: 'Abril' },
    { value: 5,  label: 'Mayo' },
    { value: 6,  label: 'Junio' },
    { value: 7,  label: 'Julio' },
    { value: 8,  label: 'Agosto' },
    { value: 9,  label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  const SELECT_CONSULTAS = `
    *,
    pacientes(nombre, edad, edad_valor, edad_tipo),
    medicos(nombre, es_referente),
    detalle_consultas(
      sub_estudios(
        nombre,
        estudios(id, nombre)
      ),
      precio,
      numero_factura,
      nit,
      numero_voucher,
      numero_transferencia,
      comentarios,
      precio_modificado,
      precio_original,
      justificacion_precio
    )
  `;

  // ✅ Supabase limita a 1000 filas por consulta si no se pagina — un mes con
  // más de 1000 consultas se cortaba a mitad de mes. Traemos todo por páginas.
  const fetchConsultasCompleto = async (primerDia: string, ultimoDia: string, soloMovil: boolean) => {
    const PAGE_SIZE = 1000;
    let desde = 0;
    let todas: any[] = [];
    while (true) {
      let query = supabase
        .from('consultas')
        .select(SELECT_CONSULTAS)
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true })
        .range(desde, desde + PAGE_SIZE - 1);
      if (soloMovil) query = query.eq('es_servicio_movil', true);
      const { data, error } = await query;
      if (error) throw error;
      todas = todas.concat(data || []);
      if (!data || data.length < PAGE_SIZE) break;
      desde += PAGE_SIZE;
    }
    return todas;
  };

  const handleGenerarReporte = async () => {
    setGenerando(true);
    try {
      showToast('Obteniendo consultas...', 'info');

      let primerDia: string;
      let ultimoDia: string;
      let mesReporte: number;
      let anioReporte: number;

      if (tipoReporte === 'dia') {
        primerDia = fechaUnica;
        ultimoDia = fechaUnica;
        // ✅ Parsear la fecha seleccionada sin conversión UTC
        const [yyyy, mm] = fechaUnica.split('-').map(Number);
        mesReporte = mm;
        anioReporte = yyyy;
      } else {
        primerDia = new Date(anio, mes - 1, 1).toISOString().split('T')[0];
        ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];
        mesReporte = mes;
        anioReporte = anio;
      }

      const consultasRaw = await fetchConsultasCompleto(primerDia, ultimoDia, false);

      const consultas = consultasRaw?.filter(c => {
        return c.anulado !== true && c.es_servicio_movil !== true;
      }) || [];

      if (!consultas || consultas.length === 0) {
        showToast('No hay consultas regulares en este período', 'error');
        setGenerando(false);
        return;
      }

      showToast('Generando archivo Excel...', 'info');

      if (tipoReporte === 'mes') {
        await generarReporteMensualUnificado(mesReporte, anioReporte, consultas);
      } else {
        await generarReporteExcel(mesReporte, anioReporte, consultas);
      }

      showToast('¡Reporte generado y descargado exitosamente!', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al generar reporte', 'error');
    } finally {
      setGenerando(false);
    }
  };

  const handleGenerarReporteMoviles = async () => {
    setGenerando(true);
    try {
      showToast('Obteniendo servicios móviles...', 'info');

      let primerDia: string;
      let ultimoDia: string;
      let mesReporte: number;
      let anioReporte: number;

      if (tipoReporte === 'dia') {
        primerDia = fechaUnica;
        ultimoDia = fechaUnica;
        // ✅ Parsear la fecha seleccionada sin conversión UTC
        const [yyyy, mm] = fechaUnica.split('-').map(Number);
        mesReporte = mm;
        anioReporte = yyyy;
      } else {
        primerDia = new Date(anio, mes - 1, 1).toISOString().split('T')[0];
        ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];
        mesReporte = mes;
        anioReporte = anio;
      }

      const consultasRaw = await fetchConsultasCompleto(primerDia, ultimoDia, true);

      const consultas = consultasRaw?.filter(c => c.anulado !== true) || [];

      if (!consultas || consultas.length === 0) {
        showToast('No hay servicios móviles en este período', 'info');
        setGenerando(false);
        return;
      }

      showToast('Generando reporte de móviles...', 'info');
      
      if (tipoReporte === 'mes') {
        await generarReporteMensualMoviles(mesReporte, anioReporte, consultas);
      } else {
        await generarReporteMoviles(mesReporte, anioReporte, consultas);
      }
      
      showToast('¡Reporte de móviles generado exitosamente!', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al generar reporte de móviles', 'error');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#064e3b] to-[#065f46] text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
              <FileSpreadsheet size={28} className="text-emerald-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Generar Reportes</h1>
              <p className="text-emerald-300 text-sm mt-0.5">Exportación de datos a Excel</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── FEATURES ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Calendar size={16} className="text-blue-500" />, bg: 'bg-blue-50', label: 'Flexible', desc: 'Un día o mes completo' },
            { icon: <FileSpreadsheet size={16} className="text-violet-500" />, bg: 'bg-violet-50', label: 'Profesional', desc: 'Colores y totales' },
            { icon: <Download size={16} className="text-emerald-500" />, bg: 'bg-emerald-50', label: 'Inmediato', desc: 'Descarga al instante' },
            { icon: <Calendar size={16} className="text-amber-500" />, bg: 'bg-amber-50', label: 'Una hoja/día', desc: 'Pestaña por día' },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
              <div className={`${f.bg} rounded-xl p-2 flex-shrink-0`}>{f.icon}</div>
              <div>
                <div className="text-xs font-black text-gray-800">{f.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CARD PRINCIPAL ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="bg-emerald-50 rounded-xl p-2"><FileSpreadsheet size={16} className="text-emerald-600" /></div>
            <h2 className="text-base font-black text-gray-900">Configurar Reporte</h2>
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* Tipo de reporte */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Tipo de reporte</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTipoReporte('dia')}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    tipoReporte === 'dia'
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {tipoReporte === 'dia' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />}
                  <Calendar size={18} className={`mb-2 ${tipoReporte === 'dia' ? 'text-emerald-600' : 'text-gray-400'}`} />
                  <div className={`text-sm font-black ${tipoReporte === 'dia' ? 'text-emerald-700' : 'text-gray-700'}`}>Un Día</div>
                  <div className={`text-xs mt-0.5 ${tipoReporte === 'dia' ? 'text-emerald-400' : 'text-gray-400'}`}>Reporte de fecha específica</div>
                </button>
                <button
                  onClick={() => setTipoReporte('mes')}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    tipoReporte === 'mes'
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {tipoReporte === 'mes' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />}
                  <FileSpreadsheet size={18} className={`mb-2 ${tipoReporte === 'mes' ? 'text-emerald-600' : 'text-gray-400'}`} />
                  <div className={`text-sm font-black ${tipoReporte === 'mes' ? 'text-emerald-700' : 'text-gray-700'}`}>Mes Completo</div>
                  <div className={`text-xs mt-0.5 ${tipoReporte === 'mes' ? 'text-emerald-400' : 'text-gray-400'}`}>Unificado con pestañas</div>
                </button>
              </div>
            </div>

            {/* Fecha / Mes-Año */}
            {tipoReporte === 'dia' ? (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={fechaUnica}
                  onChange={(e) => setFechaUnica(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Mes</label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white"
                  >
                    {meses.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Año</label>
                  <select
                    value={anio}
                    onChange={(e) => setAnio(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white"
                  >
                    {[2024, 2025, 2026, 2027].map(a => (<option key={a} value={a}>{a}</option>))}
                  </select>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="space-y-3 pt-1">
              <button
                onClick={handleGenerarReporte}
                disabled={generando}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generando ? (
                  <><LoadingSpinner />Generando reporte...</>
                ) : (
                  <><Download size={16} />Generar Reporte Regular</>
                )}
              </button>

              <button
                onClick={handleGenerarReporteMoviles}
                disabled={generando}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-3 rounded-xl font-bold text-sm shadow-sm shadow-orange-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generando ? (
                  <><LoadingSpinner />Generando móviles...</>
                ) : (
                  <><Download size={16} />Generar Reporte Servicios Móviles</>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
};