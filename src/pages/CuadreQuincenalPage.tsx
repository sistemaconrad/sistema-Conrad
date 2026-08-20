import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Calendar, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generarCuadreQuincenal, generarCuadreQuincenalMoviles } from '../utils/cuadre-quincenal-generator';

interface CuadreQuincenalPageProps {
  onBack: () => void;
}

export const CuadreQuincenalPage: React.FC<CuadreQuincenalPageProps> = ({ onBack }) => {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [quincena, setQuincena] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [loadingMoviles, setLoadingMoviles] = useState(false);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getFechas = () => {
    // Guatemala es UTC-6, entonces el inicio del dia GT = T06:00:00Z, fin = T05:59:59Z del dia siguiente
    const diaInicio = quincena === 1 ? 1 : 16;
    const diaFin = quincena === 1 ? 15 : new Date(anio, mes, 0).getDate(); // ultimo dia del mes

    const pad = (n: number) => String(n).padStart(2, '0');
    const fechaInicioStr = `${anio}-${pad(mes)}-${pad(diaInicio)}`;
    const fechaFinStr = `${anio}-${pad(mes)}-${pad(diaFin)}`;

    // UTC equivalents: GT midnight = 06:00 UTC, GT end of day = next day 05:59:59 UTC
    const fechaInicio = new Date(`${fechaInicioStr}T06:00:00.000Z`);
    const fechaFin = new Date(`${fechaFinStr}T05:59:59.999Z`);
    fechaFin.setDate(fechaFin.getDate() + 1); // +1 day since GT end-of-day is next UTC day
    return { fechaInicio, fechaFin };
  };

  const generarReporte = async () => {
    setLoading(true);
    try {
      const { fechaInicio, fechaFin } = getFechas();

      const { data: consultasRaw, error } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(nombre, edad, telefono),
          medicos(nombre),
          detalle_consultas(
            precio,
            precio_modificado,
            precio_original,
            justificacion_precio,
            sub_estudios(nombre)
          )
        `)
        .gte('fecha', fechaInicio.toISOString())
        .lte('fecha', fechaFin.toISOString())
        .eq('sin_informacion_medico', false)
        .eq('forma_pago', 'estado_cuenta')
        .order('created_at');

      if (error) throw error;

      const consultas = consultasRaw?.filter(c => c.anulado !== true) || [];

      if (!consultas || consultas.length === 0) {
        alert('No hay estados de cuenta de pacientes referidos en esta quincena');
        setLoading(false);
        return;
      }

      const consultasPorMedico: { [key: string]: any[] } = {};
      consultas.forEach(consulta => {
        const medicoNombre = consulta.medicos?.nombre || consulta.medico_recomendado || 'Sin médico';
        if (!consultasPorMedico[medicoNombre]) consultasPorMedico[medicoNombre] = [];
        consultasPorMedico[medicoNombre].push(consulta);
      });

      await generarCuadreQuincenal({ consultasPorMedico, mes: meses[mes - 1], anio, quincena, fechaInicio, fechaFin });
      alert('✅ Cuadre quincenal generado exitosamente');
    } catch (error) {
      console.error('Error al generar cuadre:', error);
      alert('Error al generar cuadre: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const generarReporteMoviles = async () => {
    setLoadingMoviles(true);
    try {
      const { fechaInicio, fechaFin } = getFechas();

      const { data: consultasRaw, error } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(nombre, edad, telefono),
          medicos(nombre),
          detalle_consultas(
            precio,
            precio_modificado,
            precio_original,
            justificacion_precio,
            sub_estudios(nombre)
          )
        `)
        .gte('fecha', fechaInicio.toISOString())
        .lte('fecha', fechaFin.toISOString())
        .eq('es_servicio_movil', true)
        .eq('forma_pago', 'estado_cuenta')
        .order('created_at');

      if (error) throw error;

      const consultas = consultasRaw?.filter(c => c.anulado !== true) || [];

      if (!consultas || consultas.length === 0) {
        alert('No hay servicios móviles con estado de cuenta en esta quincena');
        setLoadingMoviles(false);
        return;
      }

      const consultasPorMedico: { [key: string]: any[] } = {};
      consultas.forEach(consulta => {
        // ✅ Prioridad: médico referente > médico recomendado > establecimiento > fallback
        const medicoNombre = consulta.medicos?.nombre 
          || consulta.medico_recomendado 
          || consulta.movil_establecimiento 
          || 'Sin información';
        if (!consultasPorMedico[medicoNombre]) consultasPorMedico[medicoNombre] = [];
        consultasPorMedico[medicoNombre].push(consulta);
      });

      await generarCuadreQuincenalMoviles({ consultasPorMedico, mes: meses[mes - 1], anio, quincena, fechaInicio, fechaFin });
      alert('✅ Reporte de servicios móviles generado exitosamente');
    } catch (error) {
      console.error('Error al generar reporte móviles:', error);
      alert('Error al generar reporte: ' + (error as any).message);
    } finally {
      setLoadingMoviles(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#312e81] text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-indigo-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
              <Calendar size={28} className="text-indigo-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Estado de Cuenta Quincenal</h1>
              <p className="text-indigo-300 text-sm mt-0.5">Generación de cuadres por médico referente</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── CARD PRINCIPAL ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Título card */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="bg-indigo-50 rounded-xl p-2"><Calendar size={16} className="text-indigo-600" /></div>
            <h2 className="text-base font-black text-gray-900">Configurar Quincena</h2>
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* Mes y Año */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Mes</label>
                <select
                  value={mes}
                  onChange={(e) => setMes(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
                >
                  {meses.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Año</label>
                <select
                  value={anio}
                  onChange={(e) => setAnio(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
                >
                  {[2024, 2025, 2026, 2027].map(a => (<option key={a} value={a}>{a}</option>))}
                </select>
              </div>
            </div>

            {/* Selector Quincena */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quincena</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setQuincena(1)}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    quincena === 1
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {quincena === 1 && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500" />}
                  <div className={`text-sm font-black ${quincena === 1 ? 'text-indigo-700' : 'text-gray-700'}`}>1ra Quincena</div>
                  <div className={`text-xs mt-0.5 ${quincena === 1 ? 'text-indigo-400' : 'text-gray-400'}`}>Del 1 al 15</div>
                </button>
                <button
                  onClick={() => setQuincena(2)}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    quincena === 2
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {quincena === 2 && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500" />}
                  <div className={`text-sm font-black ${quincena === 2 ? 'text-indigo-700' : 'text-gray-700'}`}>2da Quincena</div>
                  <div className={`text-xs mt-0.5 ${quincena === 2 ? 'text-indigo-400' : 'text-gray-400'}`}>Del 16 al fin de mes</div>
                </button>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wide">Resumen del período</h3>
              </div>
              <p className="text-sm text-gray-700 font-semibold">
                {quincena === 1 ? `1 al 15` : `16 al ${new Date(anio, mes, 0).getDate()}`} de {meses[mes - 1]} {anio}
              </p>
              <p className="text-xs text-gray-500 mt-1">Incluye consultas con forma de pago: Estado de Cuenta</p>
              <p className="text-xs text-gray-500">Agrupado por médico referente</p>
            </div>

            {/* Botones */}
            <div className="space-y-3 pt-1">
              <button
                onClick={generarReporte}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Generando...</>
                ) : (
                  <><Download size={16} />Generar Estado de Cuenta Referentes</>
                )}
              </button>

              <button
                onClick={generarReporteMoviles}
                disabled={loadingMoviles}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm shadow-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMoviles ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Generando...</>
                ) : (
                  <><Smartphone size={16} />Generar Estado de Cuenta Servicios Móviles</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── INFO CARD ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="bg-blue-50 rounded-xl p-2"><Calendar size={16} className="text-blue-500" /></div>
            <h4 className="text-sm font-black text-gray-900">Información importante</h4>
          </div>
          <ul className="px-6 py-4 space-y-2.5">
            {[
              'Solo incluye consultas con forma de pago "Estado de Cuenta"',
              'Los servicios regulares se agrupan por médico referente',
              'Los servicios móviles se agrupan por establecimiento',
              'Se generan hojas separadas por cada médico/establecimiento',
              'Las consultas anuladas no se incluyen en el reporte'
            ].map((txt, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                {txt}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};