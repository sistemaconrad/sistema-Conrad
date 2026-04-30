import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, X, Search, Stethoscope, CheckCircle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { municipiosGuatemala } from '../../data/guatemala';

interface Medico {
  id: string;
  nombre: string;
  especialidad?: string;
  municipio: string;
  clinica?: string;
}

interface PlanItem {
  id: string;
  medico_id: string;
  medico_nombre: string;
  medico_especialidad?: string;
  medico_municipio: string;
  visitadora: string;
  fecha: string; // YYYY-MM-DD
  nota?: string;
}

const getNombreMun = (id: string) => municipiosGuatemala.find(m => m.id === id)?.nombre || id;

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Retorna el lunes de la semana actual (o con offset de semanas)
const getLunes = (offset = 0): Date => {
  const now = new Date();
  const gt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  const dia = gt.getDay(); // 0=dom
  const lunes = new Date(gt);
  lunes.setDate(gt.getDate() - ((dia + 6) % 7) + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
};

const toISO = (d: Date) => d.toLocaleDateString('en-CA');

const formatDia = (date: Date) =>
  date.toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit' });

export const PlanificadorView: React.FC = () => {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<string | null>(null); // fecha seleccionada
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
  const rolUsuario = localStorage.getItem('rolUsuarioConrad');
  const esAdmin = rolUsuario !== 'visitadora';

  // Fechas de la semana
  const lunes = getLunes(semanaOffset);
  const fechasSemana: Date[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });

  const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  useEffect(() => { cargarDatos(); }, [semanaOffset]);

  const cargarDatos = async () => {
    setLoading(true);
    const inicio = toISO(fechasSemana[0]);
    const fin    = toISO(fechasSemana[5]);

    const [{ data: med }, { data: p }] = await Promise.all([
      supabase.from('medicos').select('id,nombre,especialidad,municipio,clinica').eq('es_referente', true).eq('activo', true).order('nombre'),
      supabase.from('plan_visitas')
        .select('*')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('created_at'),
    ]);
    setMedicos(med || []);
    // Si es visitadora, solo ve su propio plan
    const filtrado = esAdmin ? (p || []) : (p || []).filter((x: PlanItem) => x.visitadora === nombreUsuario);
    setPlan(filtrado);
    setLoading(false);
  };

  const agregarAlPlan = async (medico: Medico, fecha: string) => {
    if (!fecha) return;
    setGuardando(true);
    const { data, error } = await supabase.from('plan_visitas').insert([{
      medico_id: medico.id,
      medico_nombre: medico.nombre,
      medico_especialidad: medico.especialidad || null,
      medico_municipio: medico.municipio,
      visitadora: nombreUsuario,
      fecha,
    }]).select().single();
    if (!error && data) setPlan(prev => [...prev, data]);
    setShowModal(null);
    setBusqueda('');
    setGuardando(false);
  };

  const eliminarDelPlan = async (id: string) => {
    await supabase.from('plan_visitas').delete().eq('id', id);
    setPlan(prev => prev.filter(p => p.id !== id));
  };

  const itemsDia = (fecha: string, visitadora?: string) =>
    plan.filter(p => p.fecha === fecha && (visitadora ? p.visitadora === visitadora : true));

  const medicosFiltrados = medicos.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.especialidad || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    getNombreMun(m.municipio).toLowerCase().includes(busqueda.toLowerCase())
  );

  // Si admin: mostrar por visitadora agrupado
  const visitadoras = esAdmin ? [...new Set(plan.map(p => p.visitadora))].sort() : [nombreUsuario];

  const labelSemana = `${formatDia(fechasSemana[0])} — ${formatDia(fechasSemana[5])}`;

  return (
    <div>
      {/* Header semana */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays size={20} className="text-teal-500" />
            Planificador semanal
          </h2>
          <p className="text-sm text-gray-500">{labelSemana}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSemanaOffset(s => s - 1)}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <button onClick={() => setSemanaOffset(0)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
            Hoy
          </button>
          <button onClick={() => setSemanaOffset(s => s + 1)}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>
      ) : (
        <>
          {/* Vista admin: tabla por visitadora */}
          {esAdmin ? (
            <div className="space-y-6">
              {visitadoras.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 w-32">Visitadora</th>
                          {fechasSemana.map((d, i) => (
                            <th key={i} className={`text-center text-xs font-semibold pb-3 px-2 ${toISO(d) === hoyISO ? 'text-teal-600' : 'text-gray-400'}`}>
                              <p>{DIAS_SHORT[i]}</p>
                              <p className={`text-base font-bold ${toISO(d) === hoyISO ? 'text-teal-600' : 'text-gray-700'}`}>{d.getDate()}</p>
                            </th>
                          ))}
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <p className="text-center text-sm text-gray-400 py-4">Sin planes registrados esta semana</p>
                </div>
              )}
              {visitadoras.map(vis => (
                <div key={vis} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xs font-bold">{vis[0]}</span>
                    {vis}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {fechasSemana.map((d, i) => {
                      const fISO = toISO(d);
                      const items = itemsDia(fISO, vis);
                      const esHoy = fISO === hoyISO;
                      return (
                        <div key={i} className={`rounded-xl border-2 p-2 min-h-[100px] ${esHoy ? 'border-teal-300 bg-teal-50/50' : 'border-gray-100 bg-gray-50'}`}>
                          <p className={`text-xs font-bold mb-2 ${esHoy ? 'text-teal-600' : 'text-gray-400'}`}>{DIAS_SHORT[i]} {d.getDate()}</p>
                          <div className="space-y-1.5">
                            {items.map(item => (
                              <div key={item.id} className="bg-white rounded-lg p-1.5 shadow-sm border border-gray-100 group relative">
                                <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{item.medico_nombre}</p>
                                {item.medico_especialidad && <p className="text-xs text-teal-500 truncate">{item.medico_especialidad}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Vista visitadora: grid editable */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {fechasSemana.map((d, i) => {
                const fISO = toISO(d);
                const items = itemsDia(fISO);
                const esHoy = fISO === hoyISO;
                const isPast = fISO < hoyISO;
                return (
                  <div key={i} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${esHoy ? 'border-teal-400' : 'border-gray-100'}`}>
                    {/* Header día */}
                    <div className={`px-4 py-3 flex items-center justify-between ${esHoy ? 'bg-gradient-to-r from-teal-600 to-cyan-700' : isPast ? 'bg-gray-100' : 'bg-gray-50'}`}>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wide ${esHoy ? 'text-pink-100' : 'text-gray-400'}`}>{DIAS[i]}</p>
                        <p className={`text-xl font-bold ${esHoy ? 'text-white' : 'text-gray-700'}`}>{d.getDate()}</p>
                      </div>
                      {!isPast && (
                        <button onClick={() => setShowModal(fISO)}
                          className={`p-1.5 rounded-lg transition-colors ${esHoy ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}>
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Items del día */}
                    <div className="p-3 space-y-2 min-h-[80px]">
                      {items.length === 0 ? (
                        <p className="text-xs text-gray-300 text-center pt-3">Sin visitas</p>
                      ) : items.map(item => (
                        <div key={item.id} className="bg-teal-50 border border-teal-100 rounded-xl p-2.5 group relative">
                          <button onClick={() => eliminarDelPlan(item.id)}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:bg-red-50 rounded-lg">
                            <Trash2 size={11} />
                          </button>
                          <p className="text-xs font-bold text-gray-800 pr-4 leading-tight">{item.medico_nombre}</p>
                          {item.medico_especialidad && <p className="text-xs text-teal-500 mt-0.5">{item.medico_especialidad}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{getNombreMun(item.medico_municipio)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Agregar más */}
                    {!isPast && items.length > 0 && (
                      <div className="px-3 pb-3">
                        <button onClick={() => setShowModal(fISO)}
                          className="w-full py-1.5 text-xs font-semibold text-pink-400 hover:text-teal-600 border border-dashed border-teal-200 rounded-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-1">
                          <Plus size={11} /> Agregar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL AGREGAR MÉDICO AL PLAN */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900">Agregar visita al plan</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(showModal + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
              </div>
              <button onClick={() => { setShowModal(null); setBusqueda(''); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>

            <div className="px-4 py-3 border-b">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar médico..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {medicosFiltrados.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Stethoscope size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin resultados</p>
                </div>
              ) : medicosFiltrados.map(m => {
                const yaEnPlan = plan.some(p => p.medico_id === m.id && p.fecha === showModal && p.visitadora === nombreUsuario);
                return (
                  <button key={m.id}
                    onClick={() => !yaEnPlan && !guardando && agregarAlPlan(m, showModal!)}
                    disabled={yaEnPlan || guardando}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${yaEnPlan ? 'bg-emerald-50 border-emerald-200 cursor-default' : 'border-gray-100 hover:border-teal-200 hover:bg-teal-50/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2 shrink-0 ${yaEnPlan ? 'bg-emerald-100' : 'bg-gradient-to-br from-pink-100 to-rose-100'}`}>
                        {yaEnPlan ? <CheckCircle size={15} className="text-emerald-600" /> : <Stethoscope size={15} className="text-teal-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm truncate">{m.nombre}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {m.especialidad && <span className="text-teal-500 font-medium">{m.especialidad} · </span>}
                          {getNombreMun(m.municipio)}
                        </p>
                      </div>
                      {yaEnPlan ? (
                        <span className="text-xs text-emerald-600 font-semibold shrink-0">Ya planeado</span>
                      ) : (
                        <span className="text-gray-300 text-lg">›</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
