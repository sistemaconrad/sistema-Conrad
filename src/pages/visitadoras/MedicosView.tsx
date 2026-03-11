import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, Stethoscope, Phone, MapPin, Building2 } from 'lucide-react';
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
  es_referente: boolean;
  activo: boolean;
}

const emptyForm = {
  nombre: '',
  telefono: '',
  especialidad: '',
  departamento: '',
  municipio: '',
  direccion: '',
  clinica: '',
};

const ESPECIALIDAD_COLORS: { [key: string]: string } = {
  'Pediatría': 'bg-blue-100 text-blue-700',
  'Ginecología': 'bg-pink-100 text-pink-700',
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

export const MedicosView: React.FC = () => {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Medico | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tarjetas');

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
      });
    } else {
      setEditando(null);
      setForm(emptyForm);
    }
    setShowModal(true);
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
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setVista('tarjetas')}
              className={`px-3 py-2 transition-colors ${vista === 'tarjetas' ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ⊞ Tarjetas
            </button>
            <button
              onClick={() => setVista('tabla')}
              className={`px-3 py-2 transition-colors ${vista === 'tabla' ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ☰ Lista
            </button>
          </div>
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Agregar
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
          <p className="text-2xl font-bold text-pink-600">
            {new Set(medicos.map(m => m.especialidad).filter(Boolean)).size}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Departamentos</p>
          <p className="text-2xl font-bold text-gray-800">
            {new Set(medicos.map(m => m.departamento)).size}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
        </div>
      ) : medicosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-100">
          <Stethoscope size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No hay médicos registrados</p>
        </div>
      ) : vista === 'tarjetas' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {medicosFiltrados.map(m => (
            <div key={m.id} className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-4 relative">
                <div className="flex items-start justify-between">
                  <div className="bg-white/20 rounded-xl p-2.5 backdrop-blur-sm">
                    <Stethoscope size={22} className="text-white" />
                  </div>
                  <div className="flex gap-1">
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
                  {m.clinica && <p className="text-pink-100 text-xs mt-0.5 truncate">{m.clinica}</p>}
                </div>
                {m.especialidad && (
                  <span className="inline-flex mt-2 items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/25 text-white backdrop-blur-sm">
                    {m.especialidad}
                  </span>
                )}
              </div>
              {/* Body */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="bg-pink-50 rounded-lg p-1.5">
                    <MapPin size={13} className="text-pink-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{getNombreMunicipio(m.municipio)}, {getNombreDepto(m.departamento)}</p>
                  </div>
                </div>
                {m.direccion && (
                  <div className="flex items-start gap-2">
                    <div className="bg-amber-50 rounded-lg p-1.5 shrink-0 mt-0.5">
                      <Building2 size={13} className="text-amber-500" />
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{m.direccion}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="bg-green-50 rounded-lg p-1.5">
                    <Phone size={13} className="text-green-500" />
                  </div>
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
                  <tr key={m.id} className="hover:bg-pink-50/30 transition-colors">
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
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editando ? 'Editar Médico Referente' : 'Nuevo Médico Referente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre completo *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Nombre del médico o establecimiento" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Teléfono *</label>
                  <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Ej: 5555-1234" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Especialidad</label>
                  <input type="text" value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Ej: Pediatría, Ong, Farmacia..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Departamento *</label>
                  <select value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value, municipio: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                    <option value="">Seleccionar...</option>
                    {departamentosGuatemala.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Municipio *</label>
                  <select value={form.municipio} onChange={e => setForm({ ...form, municipio: e.target.value })}
                    disabled={!form.departamento}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100">
                    <option value="">Seleccionar...</option>
                    {municipiosFiltrados.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Dirección / Referencia *</label>
                  <input type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Ej: Atrás del mercado terminal, Colonia primavera..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre de clínica / consultorio</label>
                  <input type="text" value={form.clinica} onChange={e => setForm({ ...form, clinica: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700 disabled:opacity-60">
                <Save size={15} />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};