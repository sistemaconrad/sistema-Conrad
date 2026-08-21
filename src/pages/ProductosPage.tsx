import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Estudio {
  id: string;
  nombre: string;
  porcentaje_comision?: number;
  activo: boolean;
}

interface SubEstudio {
  id: string;
  estudio_id: string;
  nombre: string;
  precio_normal: number;
  precio_social: number;
  precio_especial: number;
  disponible_movil?: boolean;
  precio_movil?: number;
  activo: boolean;
}

interface ProductosPageProps {
  onBack: () => void;
}

export const ProductosPage: React.FC<ProductosPageProps> = ({ onBack }) => {
  const [estudios, setEstudios] = useState<Estudio[]>([]);
  const [subEstudios, setSubEstudios] = useState<SubEstudio[]>([]);
  const [estudioSeleccionado, setEstudioSeleccionado] = useState<string>('');
  const [busqueda, setBusqueda] = useState(''); // Búsqueda
  
  // Modal estados
  const [showModalEstudio, setShowModalEstudio] = useState(false);
  const [showModalSubEstudio, setShowModalSubEstudio] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  
  // Formulario estudio
  const [nombreEstudio, setNombreEstudio] = useState('');
  const [porcentajeComision, setPorcentajeComision] = useState('');
  
  // Formulario sub-estudio
  const [nombreSubEstudio, setNombreSubEstudio] = useState('');
  const [precioNormal, setPrecioNormal] = useState('');
  const [precioSocial, setPrecioSocial] = useState('');
  const [precioEspecial, setPrecioEspecial] = useState('');
  const [disponibleMovil, setDisponibleMovil] = useState(false);
  const [precioMovil, setPrecioMovil] = useState('');

  useEffect(() => {
    cargarEstudios();
    cargarSubEstudios();
  }, []);

  const cargarEstudios = async () => {
    const { data } = await supabase.from('estudios').select('*').order('nombre');
    setEstudios(data || []);
  };

  const cargarSubEstudios = async () => {
    const { data } = await supabase.from('sub_estudios').select('*').order('nombre');
    setSubEstudios(data || []);
  };

  const guardarEstudio = async () => {
    if (!nombreEstudio.trim()) return;

    try {
      const dataEstudio = {
        nombre: nombreEstudio,
        porcentaje_comision: parseFloat(porcentajeComision) || 0
      };

      if (editando) {
        await supabase.from('estudios').update(dataEstudio).eq('id', editando.id);
      } else {
        await supabase.from('estudios').insert([dataEstudio]);
      }
      
      cargarEstudios();
      cerrarModalEstudio();
      alert('Estudio guardado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar estudio');
    }
  };

  const guardarSubEstudio = async () => {
    if (!estudioSeleccionado) { alert('⚠️ Selecciona el Estudio al que pertenece este sub-estudio'); return; }
    if (!nombreSubEstudio.trim()) { alert('⚠️ Ingresa el nombre del sub-estudio'); return; }

    try {
      // Verificar duplicados (solo si es nuevo, no al editar)
      if (!editando) {
        const existe = subEstudios.some(s => 
          s.nombre.toLowerCase() === nombreSubEstudio.trim().toLowerCase() && 
          s.estudio_id === estudioSeleccionado &&
          s.activo
        );
        
        if (existe) {
          alert('⚠️ Ya existe un sub-estudio con ese nombre en este estudio');
          return;
        }
      }

      const data = {
        nombre: nombreSubEstudio,
        estudio_id: estudioSeleccionado,
        precio_normal: parseFloat(precioNormal) || 0,
        precio_social: parseFloat(precioSocial) || 0,
        precio_especial: parseFloat(precioEspecial) || 0,
        disponible_movil: disponibleMovil,
        precio_movil: disponibleMovil ? (parseFloat(precioMovil) || 0) : null,
      };

      if (editando) {
        await supabase.from('sub_estudios').update(data).eq('id', editando.id);
      } else {
        await supabase.from('sub_estudios').insert([data]);
      }

      cargarSubEstudios();
      const estudioActual = estudioSeleccionado;
      cerrarModalSubEstudio();
      setEstudioSeleccionado(estudioActual); // conserva el estudio filtrado/seleccionado para poder agregar otro sub-estudio seguido
      alert('Sub-estudio guardado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar sub-estudio');
    }
  };

  const eliminarEstudio = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este estudio?')) return;
    
    await supabase.from('estudios').update({ activo: false }).eq('id', id);
    cargarEstudios();
  };

  const eliminarSubEstudio = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este sub-estudio?')) return;
    
    await supabase.from('sub_estudios').update({ activo: false }).eq('id', id);
    cargarSubEstudios();
  };

  const abrirModalEstudio = (estudio?: Estudio) => {
    if (estudio) {
      setEditando(estudio);
      setNombreEstudio(estudio.nombre);
      setPorcentajeComision(estudio.porcentaje_comision?.toString() || '0');
    }
    setShowModalEstudio(true);
  };

  const cerrarModalEstudio = () => {
    setShowModalEstudio(false);
    setEditando(null);
    setNombreEstudio('');
    setPorcentajeComision('');
  };

  const abrirModalSubEstudio = (subEstudio?: SubEstudio) => {
    if (subEstudio) {
      setEditando(subEstudio);
      setNombreSubEstudio(subEstudio.nombre);
      setEstudioSeleccionado(subEstudio.estudio_id);
      setPrecioNormal(subEstudio.precio_normal.toString());
      setPrecioSocial(subEstudio.precio_social.toString());
      setPrecioEspecial(subEstudio.precio_especial.toString());
      setDisponibleMovil(!!subEstudio.disponible_movil);
      setPrecioMovil(subEstudio.precio_movil?.toString() || '');
    }
    setShowModalSubEstudio(true);
  };

  const cerrarModalSubEstudio = () => {
    setShowModalSubEstudio(false);
    setEditando(null);
    setNombreSubEstudio('');
    setEstudioSeleccionado('');
    setPrecioNormal('');
    setPrecioSocial('');
    setPrecioEspecial('');
    setDisponibleMovil(false);
    setPrecioMovil('');
  };

  const subEstudiosFiltrados = estudioSeleccionado 
    ? subEstudios
        .filter(s => s.estudio_id === estudioSeleccionado && s.activo)
        .filter(s => s.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : [];

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>

      {/* ── HEADER ── */}
      <header className="text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%)' }}>
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2 border border-white/20">
              <Save size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Gestión de Productos</h1>
              <p className="text-blue-200 text-xs">Catálogo de estudios y servicios</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-5">

          {/* ── ESTUDIOS ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <div>
                <p className="font-black text-gray-800">Estudios</p>
                <p className="text-xs text-gray-400 mt-0.5">{estudios.filter(e => e.activo).length} activos</p>
              </div>
              <button onClick={() => abrirModalEstudio()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-200 transition-all">
                <Plus size={14} /> Nuevo
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
              {estudios.filter(e => e.activo).map(estudio => (
                <div key={estudio.id} className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors group">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{estudio.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Comisión: <span className="font-bold text-emerald-600">{estudio.porcentaje_comision || 0}%</span>
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => abrirModalEstudio(estudio)}
                      className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => eliminarEstudio(estudio.id)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SUB-ESTUDIOS ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <div>
                <p className="font-black text-gray-800">Sub-Estudios</p>
                <p className="text-xs text-gray-400 mt-0.5">{subEstudiosFiltrados.length} mostrados</p>
              </div>
              <button onClick={() => abrirModalSubEstudio()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-200 transition-all">
                <Plus size={14} /> Nuevo
              </button>
            </div>

            {/* Filtros */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-2 bg-gray-50/40">
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white"
                value={estudioSeleccionado} onChange={(e) => setEstudioSeleccionado(e.target.value)}>
                <option value="">Todos los estudios</option>
                {estudios.filter(e => e.activo).map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <input type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                placeholder="Buscar sub-estudio..."
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>

            <div className="divide-y divide-gray-50 max-h-[380px] overflow-y-auto">
              {subEstudiosFiltrados.map(sub => (
                <div key={sub.id} className="px-5 py-3 hover:bg-blue-50/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{sub.nombre}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => abrirModalSubEstudio(sub)}
                        className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => eliminarSubEstudio(sub.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Normal: Q{sub.precio_normal}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Social: Q{sub.precio_social}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Especial: Q{sub.precio_especial}</span>
                    {sub.disponible_movil && (
                      <span className="text-xs bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-full font-medium">📱 Móvil: Q{sub.precio_movil ?? 0}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL ESTUDIO ── */}
      {showModalEstudio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2"><Save size={16} className="text-blue-600" /></div>
                <h3 className="text-base font-black text-gray-900">{editando ? 'Editar' : 'Nuevo'} Estudio</h3>
              </div>
              <button onClick={cerrarModalEstudio} className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Nombre del Estudio *</label>
                <input type="text"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={nombreEstudio} onChange={(e) => setNombreEstudio(e.target.value)} placeholder="Ej: Rayos X" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Porcentaje de Comisión (%)</label>
                <input type="number" step="0.01" min="0" max="100"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={porcentajeComision} onChange={(e) => setPorcentajeComision(e.target.value)} placeholder="Ej: 15" />
                <p className="text-xs text-gray-400 mt-1">Si es 0% no aparecerá en comisiones</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={cerrarModalEstudio}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarEstudio}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUB-ESTUDIO ── */}
      {showModalSubEstudio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2"><Save size={16} className="text-blue-600" /></div>
                <h3 className="text-base font-black text-gray-900">{editando ? 'Editar' : 'Nuevo'} Sub-Estudio</h3>
              </div>
              <button onClick={cerrarModalSubEstudio} className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Estudio *</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={estudioSeleccionado} onChange={(e) => setEstudioSeleccionado(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {estudios.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Nombre del Sub-Estudio *</label>
                <input type="text"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={nombreSubEstudio} onChange={(e) => setNombreSubEstudio(e.target.value)} placeholder="Ej: Rayos X de Tórax" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Normal (Q)', val: precioNormal, set: setPrecioNormal, color: 'gray' },
                  { label: 'Social (Q)', val: precioSocial, set: setPrecioSocial, color: 'green' },
                  { label: 'Especial (Q)', val: precioEspecial, set: setPrecioEspecial, color: 'purple' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{f.label}</label>
                    <input type="number" step="0.01"
                      className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-center focus:ring-2 focus:ring-${f.color}-400 focus:border-${f.color}-400`}
                      value={f.val} onChange={(e) => f.set(e.target.value)} />
                  </div>
                ))}
              </div>
              <div className={`rounded-xl border p-3 transition-colors ${disponibleMovil ? 'bg-fuchsia-50 border-fuchsia-200' : 'border-gray-200'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={disponibleMovil}
                    onChange={(e) => setDisponibleMovil(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm font-bold text-gray-700">📱 Disponible en Servicio Móvil</span>
                </label>
                {disponibleMovil && (
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Precio Móvil (Q)</label>
                    <input type="number" step="0.01"
                      className="w-full px-3 py-2.5 border border-fuchsia-200 rounded-xl text-sm font-semibold text-center focus:ring-2 focus:ring-fuchsia-400 focus:border-fuchsia-400"
                      value={precioMovil} onChange={(e) => setPrecioMovil(e.target.value)} placeholder="0.00" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={cerrarModalSubEstudio}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarSubEstudio}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};