import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, Stethoscope, Phone, MapPin, Building2, Navigation, StickyNote, Clock, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { departamentosGuatemala, municipiosGuatemala } from '../../data/guatemala';

interface Medico {
  id: string;
  nombre: string;
  telefono: string;
  especialidad?: string;
  departamento: string;
  municipio: string;
  direccion: string;
  clinica?: string;
  referencia?: string;
  horario?: string;
  especial?: string;
  lat_establecimiento?: number | null;
  lng_establecimiento?: number | null;
  es_referente: boolean;
  activo: boolean;
}

interface Nota {
  id: string;
  medico_id: string;
  texto: string;
  autor: string;
  created_at: string;
}

const emptyForm = {
  nombre: '',
  telefono: '',
  especialidad: '',
  departamento: '',
  municipio: '',
  direccion: '',
  clinica: '',
  referencia: '',
  horario: '',
  especial: '',
  lat_establecimiento: null as number | null,
  lng_establecimiento: null as number | null,
};

const ESPECIALIDAD_COLORS: { [key: string]: string } = {
  'Pediatría': 'bg-blue-100 text-blue-700',
  'Ginecología': 'bg-teal-100 text-pink-700',
  'Medicina General': 'bg-green-100 text-green-700',
  'Cardiología': 'bg-red-100 text-red-700',
  'Ortopedia': 'bg-orange-100 text-orange-700',
  'Neurología': 'bg-purple-100 text-purple-700',
  'Veterinaria': 'bg-emerald-100 text-emerald-700',
  'Farmacia': 'bg-teal-100 text-teal-700',
  'Ong': 'bg-violet-100 text-violet-700',
};

const getEspecialidadColor = (esp?: string) => {
  if (!esp) return '';
  return ESPECIALIDAD_COLORS[esp] || 'bg-indigo-100 text-indigo-700';
};

const getNombreDepto = (id: string) =>
  departamentosGuatemala.find(d => d.id === id)?.nombre || id;

const getNombreMunicipio = (id: string) =>
  municipiosGuatemala.find(m => m.id === id)?.nombre || id;

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' });

const formatHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: true });

export const MedicosView: React.FC = () => {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Medico | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tarjetas');
  const [obteniendoGPS, setObteniendoGPS] = useState(false);

  // Notas
  const [notasModal, setNotasModal] = useState<Medico | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || 'Usuario';

  const municipiosFiltrados = municipiosGuatemala.filter(
    m => m.departamento_id === form.departamento
  );

  useEffect(() => { cargarMedicos(); }, []);

  const cargarMedicos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('medicos')
      .select('*')
      .eq('es_referente', true)
      .eq('activo', true)
      .order('nombre');
    setMedicos(data || []);
    setLoading(false);
  };

  const abrirModal = (medico?: Medico) => {
    if (medico) {
      setEditando(medico);
      setForm({
        nombre: medico.nombre,
        telefono: medico.telefono,
        especialidad: medico.especialidad || '',
        departamento: medico.departamento,
        municipio: medico.municipio,
        direccion: medico.direccion,
        clinica: medico.clinica || '',
        referencia: medico.referencia || '',
        horario: medico.horario || '',
        especial: medico.especial || '',
        lat_establecimiento: medico.lat_establecimiento ?? null,
        lng_establecimiento: medico.lng_establecimiento ?? null,
      });
    } else {
      setEditando(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const capturaGPSEstablecimiento = () => {
    if (!navigator.geolocation) { alert('Sin soporte GPS'); return; }
    setObteniendoGPS(true);
    navigator.geolocation.getCurrentPosition(
      p => {
        setForm(f => ({ ...f, lat_establecimiento: p.coords.latitude, lng_establecimiento: p.coords.longitude }));
        setObteniendoGPS(false);
      },
      () => { alert('No se pudo obtener la ubicación'); setObteniendoGPS(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.telefono || !form.departamento || !form.municipio || !form.direccion.trim()) {
      alert('Complete todos los campos obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const payload = { ...form, es_referente: true };
      if (editando) {
        await supabase.from('medicos').update(payload).eq('id', editando.id);
      } else {
        await supabase.from('medicos').insert([payload]);
      }
      cargarMedicos();
      setShowModal(false);
    } catch (e) {
      alert('Error al guardar');
    }
    setGuardando(false);
  };

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return;
    await supabase.from('medicos').update({ activo: false }).eq('id', id);
    cargarMedicos();
  };

  // ── Notas ─────────────────────────────────────────────────────
  const abrirNotas = async (m: Medico) => {
    setNotasModal(m);
    setLoadingNotas(true);
    const { data } = await supabase
      .from('notas_medicos')
      .select('*')
      .eq('medico_id', m.id)
      .order('created_at', { ascending: false });
    setNotas(data || []);
    setLoadingNotas(false);
  };

  const agregarNota = async () => {
    if (!nuevaNota.trim() || !notasModal) return;
    setGuardandoNota(true);
    const { data } = await supabase.from('notas_medicos').insert([{
      medico_id: notasModal.id,
      texto: nuevaNota.trim(),
      autor: nombreUsuario,
    }]).select().single();
    if (data) setNotas(prev => [data, ...prev]);
    setNuevaNota('');
    setGuardandoNota(false);
  };

  const eliminarNota = async (id: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    await supabase.from('notas_medicos').delete().eq('id', id);
    setNotas(prev => prev.filter(n => n.id !== id));
  };

  const medicosFiltrados = medicos.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.especialidad || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    getNombreDepto(m.departamento).toLowerCase().includes(busqueda.toLowerCase()) ||
    getNombreMunicipio(m.municipio).toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar médico, especialidad o ubicación..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
            <button onClick={() => setVista('tarjetas')} className={`px-3 py-2 transition-colors ${vista === 'tarjetas' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>⊞ Tarjetas</button>
            <button onClick={() => setVista('tabla')} className={`px-3 py-2 transition-colors ${vista === 'tabla' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>☰ Lista</button>
          </div>
          <button onClick={() => abrirModal()} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium">
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Total médicos</p>
          <p className="text-2xl font-bold text-gray-800">{medicos.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Especialidades</p>
          <p className="text-2xl font-bold text-teal-600">{new Set(medicos.map(m => m.especialidad).filter(Boolean)).size}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Con GPS fijo</p>
          <p className="text-2xl font-bold text-emerald-600">{medicos.filter(m => m.lat_establecimiento).length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" /></div>
      ) : medicosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-100">
          <Stethoscope size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No hay médicos registrados</p>
        </div>
      ) : vista === 'tarjetas' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {medicosFiltrados.map(m => (
            <div key={m.id} className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
              <div className="bg-gradient-to-br from-teal-600 to-cyan-700 p-4 relative">
                <div className="flex items-start justify-between">
                  <div className="bg-white/20 rounded-xl p-2.5 backdrop-blur-sm">
                    <Stethoscope size={22} className="text-white" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirNotas(m)} title="Notas" className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                      <StickyNote size={13} className="text-white" />
                    </button>
                    <button onClick={() => abrirModal(m)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                      <Edit2 size={13} className="text-white" />
                    </button>
                    <button onClick={() => eliminar(m.id, m.nombre)} className="p-1.5 bg-white/20 hover:bg-red-400/60 rounded-lg transition-colors">
                      <Trash2 size={13} className="text-white" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="font-bold text-white text-sm leading-tight">{m.nombre}</p>
                  {m.clinica && <p className="text-teal-100 text-xs mt-0.5 truncate">{m.clinica}</p>}
                </div>
                {m.especialidad && (
                  <span className="inline-flex mt-2 items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/25 text-white backdrop-blur-sm">{m.especialidad}</span>
                )}
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="bg-teal-50 rounded-lg p-1.5"><MapPin size={13} className="text-teal-500" /></div>
                  <p className="text-xs font-semibold text-gray-700">{getNombreMunicipio(m.municipio)}, {getNombreDepto(m.departamento)}</p>
                </div>
                {m.direccion && (
                  <div className="flex items-start gap-2">
                    <div className="bg-amber-50 rounded-lg p-1.5 shrink-0 mt-0.5"><Building2 size={13} className="text-amber-500" /></div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{m.direccion}</p>
                  </div>
                )}
                {m.referencia && (
                  <div className="flex items-start gap-2">
                    <div className="bg-blue-50 rounded-lg p-1.5 shrink-0 mt-0.5"><MapPin size={13} className="text-blue-400" /></div>
                    <p className="text-xs text-blue-600 line-clamp-2 leading-relaxed">{m.referencia}</p>
                  </div>
                )}
                {m.horario && (
                  <div className="flex items-center gap-2">
                    <div className="bg-violet-50 rounded-lg p-1.5 shrink-0"><span className="text-violet-500 text-xs font-bold">⏰</span></div>
                    <p className="text-xs text-violet-600 font-medium">{m.horario}</p>
                  </div>
                )}
                {/* GPS fijo del establecimiento */}
                {m.lat_establecimiento ? (
                  <a href={`https://maps.google.com/?q=${m.lat_establecimiento},${m.lng_establecimiento}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors">
                    <Navigation size={12} className="text-emerald-600 shrink-0" />
                    <span className="text-xs text-emerald-700 font-semibold">Ver ubicación fija</span>
                    <span className="text-emerald-400 text-xs ml-auto">↗</span>
                  </a>
                ) : (
                  <p className="text-xs text-gray-300 flex items-center gap-1"><Navigation size={11} /> Sin GPS del establecimiento</p>
                )}
                <div className="flex items-center gap-2">
                  <div className="bg-green-50 rounded-lg p-1.5"><Phone size={13} className="text-green-500" /></div>
                  <a href={`tel:${m.telefono}`} className="text-sm text-green-600 font-bold hover:underline">{m.telefono}</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Médico</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Especialidad</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contacto</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ubicación</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medicosFiltrados.map(m => (
                  <tr key={m.id} className="hover:bg-teal-50/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900 text-sm">{m.nombre}</p>
                      {m.clinica && <p className="text-xs text-gray-400">{m.clinica}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {m.especialidad
                        ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEspecialidadColor(m.especialidad)}`}>{m.especialidad}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <Phone size={13} className="text-green-400" />{m.telefono}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-700">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-pink-400" />
                        <span className="font-medium">{getNombreMunicipio(m.municipio)}, {getNombreDepto(m.departamento)}</span>
                      </div>
                      {m.direccion && <p className="text-gray-400 mt-0.5 pl-4">{m.direccion}</p>}
                      {m.lat_establecimiento && (
                        <a href={`https://maps.google.com/?q=${m.lat_establecimiento},${m.lng_establecimiento}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-emerald-600 font-semibold mt-0.5 pl-4 hover:underline">
                          <Navigation size={10} /> Ver GPS fijo ↗
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirNotas(m)} title="Notas" className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"><StickyNote size={15} /></button>
                        <button onClick={() => abrirModal(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={15} /></button>
                        <button onClick={() => eliminar(m.id, m.nombre)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR/EDITAR ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10 rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-800">
                {editando ? 'Editar Médico Referente' : 'Nuevo Médico Referente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre completo *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Nombre del médico o establecimiento" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Teléfono *</label>
                  <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ej: 5555-1234" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Especialidad</label>
                  <input type="text" value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ej: Pediatría, Ong, Farmacia..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Departamento *</label>
                  <select value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value, municipio: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option value="">Seleccionar...</option>
                    {departamentosGuatemala.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Municipio *</label>
                  <select value={form.municipio} onChange={e => setForm({ ...form, municipio: e.target.value })}
                    disabled={!form.departamento}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100">
                    <option value="">Seleccionar...</option>
                    {municipiosFiltrados.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Dirección *</label>
                  <input type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ej: Atrás del mercado terminal..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre de clínica / consultorio</label>
                  <input type="text" value={form.clinica} onChange={e => setForm({ ...form, clinica: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Opcional" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Referencia de ubicación</label>
                  <input type="text" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ej: Enfrente de la entrada de Zaragoza a mano izquierda" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Horario</label>
                  <input type="text" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ej: 8AM a 4:30PM" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Especial</label>
                  <input type="text" value={form.especial} onChange={e => setForm({ ...form, especial: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Notas especiales (opcional)" />
                </div>

                {/* GPS ESTABLECIMIENTO */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    📍 GPS del Establecimiento
                  </label>
                  {form.lat_establecimiento ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Navigation size={14} className="text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">Ubicación capturada ✓</span>
                        </div>
                        <p className="text-xs text-emerald-600 font-mono">{form.lat_establecimiento?.toFixed(6)}, {form.lng_establecimiento?.toFixed(6)}</p>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, lat_establecimiento: null, lng_establecimiento: null }))}
                        className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl border border-red-100 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={capturaGPSEstablecimiento} disabled={obteniendoGPS}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-60">
                      {obteniendoGPS
                        ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500" /> Obteniendo GPS...</>
                        : <><Navigation size={16} /> Capturar GPS del lugar</>}
                    </button>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">Estando en la clínica, captura las coordenadas fijas del establecimiento.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-60">
                <Save size={15} />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOTAS ───────────────────────────────────────── */}
      {notasModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <StickyNote size={16} className="text-amber-500" />
                  <h3 className="font-bold text-gray-900">Notas</h3>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{notasModal.nombre}</p>
              </div>
              <button onClick={() => { setNotasModal(null); setNuevaNota(''); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>

            {/* Input nueva nota */}
            <div className="px-4 py-3 border-b bg-amber-50/50">
              <div className="flex gap-2">
                <textarea
                  value={nuevaNota}
                  onChange={e => setNuevaNota(e.target.value)}
                  rows={2}
                  placeholder="Escribe una nota sobre este médico..."
                  className="flex-1 px-3 py-2 border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none bg-white"
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) agregarNota(); }}
                />
                <button onClick={agregarNota} disabled={!nuevaNota.trim() || guardandoNota}
                  className="px-3 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors self-end">
                  {guardandoNota ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Ctrl+Enter para guardar rápido</p>
            </div>

            {/* Lista de notas */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {loadingNotas ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
              ) : notas.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <StickyNote size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Sin notas aún</p>
                  <p className="text-xs">Agrega la primera nota arriba</p>
                </div>
              ) : notas.map(n => (
                <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3 group">
                  <p className="text-sm text-gray-800 leading-relaxed">{n.texto}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={10} />
                      <span>{formatFecha(n.created_at)} {formatHora(n.created_at)}</span>
                      <span className="text-amber-500 font-medium">· {n.autor}</span>
                    </div>
                    <button onClick={() => eliminarNota(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
