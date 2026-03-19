import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Calendar, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AusenciasPageProps { onBack: () => void; }

export const AusenciasPage: React.FC<AusenciasPageProps> = ({ onBack }) => {
  const [ausencias, setAusencias] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [form, setForm] = useState({
    empleado_id: '', tipo: 'permiso', fecha_inicio: '', fecha_fin: '',
    motivo: '', estado: 'pendiente'
  });

  const tipos = [
    { id: 'permiso',   label: 'Permiso',   color: 'bg-blue-100 text-blue-700'    },
    { id: 'vacaciones',label: 'Vacaciones', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'enfermedad',label: 'Enfermedad', color: 'bg-red-100 text-red-700'     },
    { id: 'otro',      label: 'Otro',       color: 'bg-slate-100 text-slate-700'  },
  ];

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [ausRes, empRes] = await Promise.all([
        supabase.from('ausencias').select('*, empleados(nombres, apellidos, codigo_empleado)').order('fecha_inicio', { ascending: false }),
        supabase.from('empleados').select('id, nombres, apellidos, codigo_empleado').eq('estado', 'activo').order('nombres'),
      ]);
      setAusencias(ausRes.data || []);
      setEmpleados(empRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const guardar = async () => {
    if (!form.empleado_id || !form.fecha_inicio || !form.fecha_fin) {
      alert('Complete empleado, fecha inicio y fecha fin'); return;
    }
    try {
      const { error } = await supabase.from('ausencias').insert([form]);
      if (error) throw error;
      setShowModal(false);
      setForm({ empleado_id: '', tipo: 'permiso', fecha_inicio: '', fecha_fin: '', motivo: '', estado: 'pendiente' });
      cargarDatos();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from('ausencias').update({ estado }).eq('id', id);
    cargarDatos();
  };

  const diasEntre = (ini: string, fin: string) => {
    const d = (new Date(fin + 'T12:00:00').getTime() - new Date(ini + 'T12:00:00').getTime()) / 86400000;
    return Math.round(d) + 1;
  };

  const getTipoColor = (tipo: string) => tipos.find(t => t.id === tipo)?.color || 'bg-slate-100 text-slate-700';
  const getTipoLabel = (tipo: string) => tipos.find(t => t.id === tipo)?.label || tipo;

  const getEstadoEl = (estado: string) => {
    if (estado === 'aprobado')  return <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100"><CheckCircle size={11} />Aprobado</span>;
    if (estado === 'rechazado') return <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-xl border border-red-100"><XCircle size={11} />Rechazado</span>;
    return <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100"><Clock size={11} />Pendiente</span>;
  };

  const filtradas = filtroEstado === 'todos' ? ausencias : ausencias.filter(a => a.estado === filtroEstado);

  return (
    <div className="min-h-screen bg-slate-50">
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#78350f 50%,#92400e 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-amber-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10"><Calendar size={24} className="text-amber-200" /></div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Ausencias y Permisos</h1>
                <p className="text-amber-300 text-sm mt-0.5">Control de permisos, vacaciones y ausencias</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all">
              <Plus size={15} /> Nueva Ausencia
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total',      val: ausencias.length,                                       color: 'text-slate-800',  bg: 'bg-white'        },
            { label: 'Pendientes', val: ausencias.filter(a => a.estado === 'pendiente').length,  color: 'text-amber-700',  bg: 'bg-amber-50'     },
            { label: 'Aprobadas',  val: ausencias.filter(a => a.estado === 'aprobado').length,   color: 'text-emerald-700',bg: 'bg-emerald-50'   },
            { label: 'Rechazadas', val: ausencias.filter(a => a.estado === 'rechazado').length,  color: 'text-red-700',    bg: 'bg-red-50'       },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-2 flex-wrap">
          {['todos', 'pendiente', 'aprobado', 'rechazado'].map(f => (
            <button key={f} onClick={() => setFiltroEstado(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${filtroEstado === f ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f === 'todos' ? 'Todos' : f}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-14 text-center">
              <Calendar size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm text-slate-400">No hay ausencias registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Empleado','Tipo','Período','Días','Motivo','Estado','Acciones'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtradas.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800">{a.empleados?.nombres} {a.empleados?.apellidos}</p>
                        <p className="text-xs text-slate-400 font-mono">{a.empleados?.codigo_empleado}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${getTipoColor(a.tipo)}`}>{getTipoLabel(a.tipo)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        <p>{new Date(a.fecha_inicio + 'T12:00:00').toLocaleDateString('es-GT')}</p>
                        <p className="text-slate-400">al {new Date(a.fecha_fin + 'T12:00:00').toLocaleDateString('es-GT')}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-lg font-black text-slate-700">{diasEntre(a.fecha_inicio, a.fecha_fin)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[160px] truncate">{a.motivo || '—'}</td>
                      <td className="px-5 py-3.5">{getEstadoEl(a.estado)}</td>
                      <td className="px-5 py-3.5">
                        {a.estado === 'pendiente' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => cambiarEstado(a.id, 'aprobado')}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors">
                              <CheckCircle size={14} />
                            </button>
                            <button onClick={() => cambiarEstado(a.id, 'rechazado')}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                              <XCircle size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{background:'linear-gradient(135deg,#0f172a,#92400e)'}}>
              <div className="flex items-center gap-3">
                <div className="bg-white/15 rounded-xl p-2"><Calendar size={16} className="text-white" /></div>
                <p className="text-white font-black text-sm">Nueva Ausencia / Permiso</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Empleado *</label>
                <select value={form.empleado_id} onChange={e => setForm({...form, empleado_id: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white">
                  <option value="">Seleccionar...</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  {tipos.map(t => (
                    <button key={t.id} type="button" onClick={() => setForm({...form, tipo: t.id})}
                      className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${form.tipo === t.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Fecha Inicio *</label>
                  <input type="date" value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Fecha Fin *</label>
                  <input type="date" value={form.fecha_fin} onChange={e => setForm({...form, fecha_fin: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Motivo</label>
                <textarea value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} rows={2}
                  placeholder="Describe el motivo..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-semibold">Cancelar</button>
                <button onClick={guardar}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};