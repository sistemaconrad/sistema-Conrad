import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, FileText, Upload, Search, Filter, Calendar,
  User, Stethoscope, CheckCircle, Clock, AlertCircle,
  Users, ClipboardList
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ArchivosModal } from '../components/ArchivosModal';

interface DoctoresPageProps { onBack: () => void; }

interface Paciente {
  id: string; consulta_id: string; nombre: string; edad: string;
  telefono: string; fecha: string; hora: string; estudios: string[];
  medico_referente: string; numero_paciente: number;
  tiene_informe: boolean; tiene_archivos: boolean;
}

type FiltroEstudio = 'TODOS' | 'RX' | 'USG' | 'TAC' | 'EKG' | 'MAMO' | 'PAP' | 'LAB';

const colorEstudio = (e: string) => {
  const up = e.toUpperCase();
  if (up.includes('TAC') || up.includes('TOMOG')) return 'bg-violet-100 text-violet-700 border-violet-200';
  if (up.includes('RX') || up.includes('RAYO')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (up.includes('USG') || up.includes('ULTRA')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
  if (up.includes('EKG') || up.includes('ELECTRO')) return 'bg-green-100 text-green-700 border-green-200';
  if (up.includes('MAMO')) return 'bg-pink-100 text-pink-700 border-pink-200';
  if (up.includes('LAB') || up.includes('LABORA')) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (up.includes('PAP')) return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

export const DoctoresPage: React.FC<DoctoresPageProps> = ({ onBack }) => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [pacientesFiltrados, setPacientesFiltrados] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstudio, setFiltroEstudio] = useState<FiltroEstudio>('TODOS');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null);
  const [mostrarModalArchivos, setMostrarModalArchivos] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
    const gt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    return `${gt.getFullYear()}-${String(gt.getMonth() + 1).padStart(2, '0')}-${String(gt.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => { cargarPacientes(); }, [fechaSeleccionada]);
  useEffect(() => { filtrarPacientes(); }, [pacientes, busqueda, filtroEstudio]);

  const cargarPacientes = async () => {
    setLoading(true);
    try {
      const { data: consultas } = await supabase
        .from('consultas')
        .select(`id, numero_paciente, fecha, created_at, medico_recomendado, sin_informacion_medico,
          pacientes (id, nombre, edad, edad_valor, edad_tipo, telefono),
          medicos (nombre),
          detalle_consultas (sub_estudios (nombre, estudios (nombre)))`)
        .eq('fecha', fechaSeleccionada)
        .or('anulado.is.null,anulado.eq.false')
        .or('es_servicio_movil.is.null,es_servicio_movil.eq.false')
        .order('numero_paciente', { ascending: true });

      const lista = await Promise.all((consultas || []).map(async (c: any) => {
        const [{ data: informes }, { data: archivos }] = await Promise.all([
          supabase.from('informes_medicos').select('id').eq('consulta_id', c.id).limit(1),
          supabase.from('archivos_estudios').select('id').eq('consulta_id', c.id).limit(1),
        ]);
        return {
          consulta_id: c.id, id: c.pacientes.id,
          nombre: c.pacientes.nombre,
          edad: c.pacientes.edad_valor && c.pacientes.edad_tipo
            ? `${c.pacientes.edad_valor} ${c.pacientes.edad_tipo}` : `${c.pacientes.edad} años`,
          telefono: c.pacientes.telefono || '',
          fecha: c.fecha,
          hora: new Date(c.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false }),
          estudios: c.detalle_consultas.map((d: any) => d.sub_estudios.nombre),
          medico_referente: c.sin_informacion_medico ? 'SIN INFORMACIÓN' : (c.medicos?.nombre || c.medico_recomendado || 'N/A'),
          numero_paciente: c.numero_paciente || 0,
          tiene_informe: (informes?.length || 0) > 0,
          tiene_archivos: (archivos?.length || 0) > 0,
        };
      }));
      setPacientes(lista);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtrarPacientes = () => {
    let f = [...pacientes];
    if (busqueda) f = f.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.numero_paciente.toString().includes(busqueda));
    if (filtroEstudio !== 'TODOS') f = f.filter(p => p.estudios.some(e => e.toUpperCase().includes(filtroEstudio)));
    setPacientesFiltrados(f);
  };

  const stats = {
    total: pacientesFiltrados.length,
    conInforme: pacientesFiltrados.filter(p => p.tiene_informe).length,
    conArchivos: pacientesFiltrados.filter(p => p.tiene_archivos).length,
    pendientes: pacientesFiltrados.filter(p => !p.tiene_informe).length,
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 50%, #f5f0ff 100%)' }}>

      {/* Header elegante */}
      <header style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #4f46e5 100%)' }} className="shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <button onClick={onBack} className="flex items-center gap-1.5 text-indigo-200 hover:text-white mb-4 transition-colors text-sm">
            <ArrowLeft size={15} /> Volver al Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/15 rounded-2xl p-3">
                <Stethoscope size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Módulo de Doctores</h1>
                <p className="text-indigo-200 text-sm mt-0.5">Gestión de informes y estudios médicos</p>
              </div>
            </div>
            {/* Stats en el header */}
            <div className="hidden md:flex items-center gap-3">
              {[
                { label: 'Pacientes', value: stats.total, icon: Users, color: 'text-blue-200' },
                { label: 'Con informe', value: stats.conInforme, icon: FileText, color: 'text-green-300' },
                { label: 'Pendientes', value: stats.pendientes, icon: AlertCircle, color: 'text-amber-300' },
              ].map(s => (
                <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 text-center border border-white/10">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-indigo-200 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Stats móvil */}
        <div className="grid grid-cols-4 gap-3 mb-5 md:hidden">
          {[
            { label: 'Total', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
            { label: 'Informes', value: stats.conInforme, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Archivos', value: stats.conArchivos, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
            { label: 'Pendientes', value: stats.pendientes, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Barra de filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Fecha */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <Calendar size={15} className="text-indigo-500 shrink-0" />
              <input type="date" value={fechaSeleccionada}
                onChange={e => setFechaSeleccionada(e.target.value)}
                className="bg-transparent text-sm text-gray-700 focus:outline-none" />
            </div>
            {/* Búsqueda */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex-1">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input type="text" placeholder="Buscar por nombre o número..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="bg-transparent text-sm text-gray-700 flex-1 focus:outline-none placeholder-gray-400" />
            </div>
            {/* Tipo estudio */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <Filter size={15} className="text-gray-400 shrink-0" />
              <select value={filtroEstudio} onChange={e => setFiltroEstudio(e.target.value as FiltroEstudio)}
                className="bg-transparent text-sm text-gray-700 focus:outline-none cursor-pointer">
                <option value="TODOS">Todos los estudios</option>
                <option value="RX">Rayos X</option>
                <option value="USG">Ultrasonido</option>
                <option value="TAC">Tomografía</option>
                <option value="EKG">EKG</option>
                <option value="MAMO">Mamografía</option>
                <option value="PAP">Papanicolaou</option>
                <option value="LAB">Laboratorio</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla / Lista de pacientes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Cabecera de la tabla */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-indigo-500" />
              <h2 className="font-bold text-gray-800">
                Pacientes — {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pacientesFiltrados.length}
              </span>
            </div>
            {stats.pendientes > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full font-medium">
                <AlertCircle size={13} /> {stats.pendientes} sin informe
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-100 border-t-indigo-600" style={{ borderWidth: 3 }} />
              <p className="text-sm text-gray-400">Cargando pacientes...</p>
            </div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="text-center py-20">
              <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <User size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">No hay pacientes para esta fecha</p>
              <p className="text-sm text-gray-300 mt-1">Intenta cambiar la fecha o los filtros</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pacientesFiltrados.map((p, idx) => (
                <div key={p.consulta_id}
                  className={`px-6 py-4 hover:bg-indigo-50/30 transition-colors ${!p.tiene_informe ? '' : ''}`}>
                  <div className="flex items-center gap-4">

                    {/* Número */}
                    <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)', color: 'white' }}>
                      {p.numero_paciente}
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{p.nombre}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{p.edad}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={11} /> {p.hora}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500 truncate max-w-[180px]">
                          👨‍⚕️ {p.medico_referente}
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          {p.estudios.map((e, i) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorEstudio(e)}`}>
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Badges estado */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {p.tiene_informe ? (
                        <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle size={11} /> Informe
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-500 border border-amber-100 px-2.5 py-1 rounded-full font-medium">
                          <AlertCircle size={11} /> Pendiente
                        </span>
                      )}
                      {p.tiene_archivos && (
                        <span className="flex items-center gap-1 text-xs bg-violet-50 text-violet-600 border border-violet-100 px-2.5 py-1 rounded-full font-medium">
                          <FileText size={11} /> Archivos
                        </span>
                      )}
                    </div>

                    {/* Botón acción — solo subir PDF */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setPacienteSeleccionado(p); setMostrarModalArchivos(true); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                          p.tiene_archivos
                            ? 'bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}>
                        <Upload size={13} />
                        {p.tiene_archivos ? 'Ver / Subir PDF' : 'Subir PDF'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {mostrarModalArchivos && pacienteSeleccionado && (
        <ArchivosModal paciente={pacienteSeleccionado}
          onClose={() => { setMostrarModalArchivos(false); setPacienteSeleccionado(null); }}
          onUploaded={() => { setMostrarModalArchivos(false); setPacienteSeleccionado(null); cargarPacientes(); }} />
      )}
    </div>
  );
};