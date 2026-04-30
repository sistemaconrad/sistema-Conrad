import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus, Stethoscope, MapPin, Phone, Clock, Search, X,
  AlertCircle, CheckCircle, Trash2, Navigation,
  PenTool, MessageSquare, Plus, Edit2, Save, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { departamentosGuatemala, municipiosGuatemala } from '../../data/guatemala';

interface Medico {
  id: string; nombre: string; especialidad?: string;
  departamento: string; municipio: string; direccion: string;
  clinica?: string; telefono: string; es_referente: boolean;
  activo: boolean; created_at: string;
}
interface VisitaProspecto {
  id: string; medico_id: string; created_at: string;
  visitadora_nombre: string; comentario?: string;
}

const getNombreDepto = (id: string) => departamentosGuatemala.find(d => d.id === id)?.nombre || id;
const getNombreMun   = (id: string) => municipiosGuatemala.find(m => m.id === id)?.nombre || id;

// Devuelve días desde la última visita (o desde creación si nunca visitado)
const diasSinVisita = (medico: Medico, visitas: VisitaProspecto[]): number => {
  const vis = visitas.filter(v => v.medico_id === medico.id);
  const ultima = vis.length > 0
    ? new Date(Math.max(...vis.map(v => new Date(v.created_at).getTime())))
    : new Date(medico.created_at);
  const hoy = new Date();
  return Math.floor((hoy.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
};

const BadgeDias = ({ dias }: { dias: number }) => {
  if (dias < 7) return null;
  if (dias >= 15) return (
    <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
      <AlertCircle size={11} /> {dias}d sin visita
    </span>
  );
  return (
    <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">
      <AlertTriangle size={11} /> {dias}d sin visita
    </span>
  );
};

export const ProspectosView: React.FC = () => {
  const [prospectos, setProspectos] = useState<Medico[]>([]);
  const [visitas, setVisitas]       = useState<VisitaProspecto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [eliminando, setEliminando]     = useState(false);

  const [modalProspecto, setModalProspecto] = useState<Medico | null>(null);
  const [confirmConvertir, setConfirmConvertir] = useState(false);
  const [confirmEliminar, setConfirmEliminar]   = useState(false);
  const [modoEdicion, setModoEdicion]           = useState(false);
  const [editNombre, setEditNombre]             = useState('');
  const [editTelefono, setEditTelefono]         = useState('');
  const [editDireccion, setEditDireccion]       = useState('');
  const [editClinica, setEditClinica]           = useState('');
  const [guardandoEdit, setGuardandoEdit]       = useState(false);

  const [visitaProspecto, setVisitaProspecto] = useState<Medico | null>(null);
  const [ubicacionObtenida, setUbicacionObtenida] = useState(false);
  const [latitud, setLatitud]     = useState<number | null>(null);
  const [longitud, setLongitud]   = useState<number | null>(null);
  const [obteniendoUbic, setObteniendoUbic] = useState(false);
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [comentario, setComentario]         = useState('');
  const [guardandoVisita, setGuardandoVisita] = useState(false);

  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaGuardada, setFirmaGuardada]   = useState<string | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [dibujando, setDibujando] = useState(false);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Filtro de urgencia
  const [filtroUrgencia, setFiltroUrgencia] = useState<'todos' | 'alerta' | 'urgente'>('todos');

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: medicos }, { data: vis }] = await Promise.all([
      supabase.from('medicos').select('*').eq('es_referente', false).eq('activo', true).order('created_at', { ascending: false }),
      supabase.from('visitas_medicas').select('id,medico_id,created_at,visitadora_nombre,comentario').order('created_at', { ascending: false })
    ]);
    setProspectos(medicos || []);
    setVisitas(vis || []);
    setLoading(false);
  };

  const visitasDe = (id: string) => visitas.filter(v => v.medico_id === id);

  // Canvas firma
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) { const t = e.touches[0]; return { x: t.clientX - rect.left, y: t.clientY - rect.top }; }
    const m = e as React.MouseEvent;
    return { x: m.clientX - rect.left, y: m.clientY - rect.top };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); setDibujando(true); lastPos.current = getPos(e); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!dibujando || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastPos.current!.x, lastPos.current!.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    lastPos.current = pos; setFirmaVacia(false);
  };
  const endDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); setDibujando(false); };
  const limpiarFirma = () => { const c = canvasRef.current; if (c) { c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setFirmaVacia(true); } };
  const confirmarFirma = () => { if (firmaVacia) { alert('Dibuja la firma primero'); return; } setFirmaGuardada(canvasRef.current!.toDataURL('image/png')); setShowFirmaModal(false); };
  const sizearCanvas = () => { const c = canvasRef.current; if (!c) return; const p = c.parentElement; if (!p) return; c.width = p.clientWidth; c.height = 200; };
  const abrirFirmaModal = () => { setFirmaVacia(true); setShowFirmaModal(true); setTimeout(() => { sizearCanvas(); const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); }, 80); };

  const obtenerUbicacion = () => {
    if (!navigator.geolocation) { alert('Sin soporte GPS'); return; }
    setObteniendoUbic(true);
    navigator.geolocation.getCurrentPosition(
      p => { setLatitud(p.coords.latitude); setLongitud(p.coords.longitude); setUbicacionObtenida(true); setObteniendoUbic(false); },
      () => { alert('No se pudo obtener ubicación'); setObteniendoUbic(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const convertirAReferente = async () => {
    if (!modalProspecto) return;
    setConvirtiendo(true);
    await supabase.from('medicos').update({ es_referente: true }).eq('id', modalProspecto.id);
    await cargarDatos();
    setModalProspecto(null); setConfirmConvertir(false);
    setConvirtiendo(false);
  };

  const eliminarProspecto = async () => {
    if (!modalProspecto) return;
    setEliminando(true);
    await supabase.from('medicos').update({ activo: false }).eq('id', modalProspecto.id);
    await cargarDatos();
    setModalProspecto(null); setConfirmEliminar(false);
    setEliminando(false);
  };

  const guardarEdicion = async () => {
    if (!modalProspecto) return;
    setGuardandoEdit(true);
    await supabase.from('medicos').update({ nombre: editNombre, telefono: editTelefono, direccion: editDireccion, clinica: editClinica }).eq('id', modalProspecto.id);
    await cargarDatos();
    setModalProspecto(prev => prev ? { ...prev, nombre: editNombre, telefono: editTelefono, direccion: editDireccion, clinica: editClinica } : null);
    setModoEdicion(false); setGuardandoEdit(false);
  };

  const registrarVisitaProspecto = async () => {
    if (!visitaProspecto) return;
    if (!ubicacionObtenida) { alert('Debes obtener la ubicación GPS'); return; }
    if (!firmaGuardada) { alert('Debes obtener la firma'); return; }
    if (!nombreReceptor.trim()) { alert('Indica quién recibió la visita'); return; }
    setGuardandoVisita(true);
    try {
      const visitadora = localStorage.getItem('nombreUsuarioConrad') || 'Visitadora';
      await supabase.from('visitas_medicas').insert([{
        medico_id: visitaProspecto.id, medico_nombre: visitaProspecto.nombre,
        medico_especialidad: visitaProspecto.especialidad || null,
        visitadora_nombre: visitadora, latitud, longitud,
        firma_receptor: firmaGuardada, nombre_receptor: nombreReceptor,
        comentario: comentario || null
      }]);
      await cargarDatos();
      setVisitaProspecto(null);
      setUbicacionObtenida(false); setLatitud(null); setLongitud(null);
      setFirmaGuardada(null); setNombreReceptor(''); setComentario('');
      alert('✅ Visita registrada');
    } catch { alert('Error al registrar visita'); }
    setGuardandoVisita(false);
  };

  // Filtrado
  let prospectosFiltrados = prospectos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    getNombreDepto(p.departamento).toLowerCase().includes(busqueda.toLowerCase()) ||
    getNombreMun(p.municipio).toLowerCase().includes(busqueda.toLowerCase())
  );
  if (filtroUrgencia === 'alerta') prospectosFiltrados = prospectosFiltrados.filter(p => diasSinVisita(p, visitas) >= 7 && diasSinVisita(p, visitas) < 15);
  if (filtroUrgencia === 'urgente') prospectosFiltrados = prospectosFiltrados.filter(p => diasSinVisita(p, visitas) >= 15);

  const urgentes = prospectos.filter(p => diasSinVisita(p, visitas) >= 15).length;
  const alertas  = prospectos.filter(p => { const d = diasSinVisita(p, visitas); return d >= 7 && d < 15; }).length;

  return (
    <div>
      {/* Cabecera con filtros de urgencia */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar prospecto..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent" />
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <button onClick={() => setFiltroUrgencia('todos')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${filtroUrgencia === 'todos' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Todos ({prospectos.length})
          </button>
          <button onClick={() => setFiltroUrgencia('alerta')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${filtroUrgencia === 'alerta' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100'}`}>
            <AlertTriangle size={11} /> {alertas} alerta
          </button>
          <button onClick={() => setFiltroUrgencia('urgente')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${filtroUrgencia === 'urgente' ? 'bg-red-500 text-white' : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'}`}>
            <AlertCircle size={11} /> {urgentes} urgente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" /></div>
      ) : prospectosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin prospectos en este filtro</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prospectosFiltrados.map(p => {
            const vis = visitasDe(p.id);
            const dias = diasSinVisita(p, visitas);
            return (
              <div key={p.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all overflow-hidden cursor-pointer"
                onClick={() => { setModalProspecto(p); setModoEdicion(false); setConfirmConvertir(false); setConfirmEliminar(false); }}>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-4">
                  <div className="flex items-start justify-between">
                    <div className="bg-white/20 rounded-xl p-2"><UserPlus size={18} className="text-white" /></div>
                    <BadgeDias dias={dias} />
                  </div>
                  <p className="font-bold text-white text-sm mt-3 leading-tight">{p.nombre}</p>
                  {p.clinica && <p className="text-teal-100 text-xs mt-0.5 truncate">{p.clinica}</p>}
                  {p.especialidad && <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/25 text-white">{p.especialidad}</span>}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <MapPin size={12} className="text-teal-400 shrink-0" />
                    <span className="truncate">{getNombreMun(p.municipio)}, {getNombreDepto(p.departamento)}</span>
                  </div>
                  {p.telefono && (
                    <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                      <Phone size={12} className="text-green-400 shrink-0" />
                      {p.telefono}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock size={12} className="shrink-0" />
                    {vis.length === 0 ? 'Sin visitas aún' : `${vis.length} visita${vis.length > 1 ? 's' : ''} · hace ${dias}d`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL DETALLE PROSPECTO ───────────────────────────── */}
      {modalProspecto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-2"><UserPlus size={15} className="text-white" /></div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{modalProspecto.nombre}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <BadgeDias dias={diasSinVisita(modalProspecto, visitas)} />
                    {visitasDe(modalProspecto.id).length > 0 && (
                      <span className="text-xs text-gray-400">{visitasDe(modalProspecto.id).length} visita(s)</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setModalProspecto(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-3">
              {modoEdicion ? (
                <div className="space-y-3">
                  <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none" placeholder="Nombre" />
                  <input type="text" value={editTelefono} onChange={e => setEditTelefono(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none" placeholder="Teléfono" />
                  <input type="text" value={editClinica} onChange={e => setEditClinica(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none" placeholder="Clínica (opcional)" />
                  <input type="text" value={editDireccion} onChange={e => setEditDireccion(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none" placeholder="Dirección" />
                  <div className="flex gap-2">
                    <button onClick={() => setModoEdicion(false)} className="flex-1 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">Cancelar</button>
                    <button onClick={guardarEdicion} disabled={guardandoEdit} className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold hover:bg-teal-600 disabled:opacity-60 flex items-center justify-center gap-2">
                      <Save size={14} />{guardandoEdit ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    {modalProspecto.especialidad && <div className="flex gap-2"><Stethoscope size={14} className="text-teal-400 mt-0.5 shrink-0" /><span className="text-gray-700">{modalProspecto.especialidad}</span></div>}
                    <div className="flex gap-2"><MapPin size={14} className="text-pink-400 mt-0.5 shrink-0" /><span className="text-gray-700">{getNombreMun(modalProspecto.municipio)}, {getNombreDepto(modalProspecto.departamento)}</span></div>
                    {modalProspecto.direccion && <div className="flex gap-2"><MapPin size={14} className="text-gray-300 mt-0.5 shrink-0" /><span className="text-gray-500 text-xs">{modalProspecto.direccion}</span></div>}
                    {modalProspecto.telefono && <div className="flex gap-2"><Phone size={14} className="text-green-400 mt-0.5 shrink-0" /><a href={`tel:${modalProspecto.telefono}`} className="text-green-600 font-bold hover:underline">{modalProspecto.telefono}</a></div>}
                  </div>
                  <button onClick={() => { setModoEdicion(true); setEditNombre(modalProspecto.nombre); setEditTelefono(modalProspecto.telefono); setEditDireccion(modalProspecto.direccion); setEditClinica(modalProspecto.clinica || ''); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                    <Edit2 size={14} /> Editar datos
                  </button>
                </>
              )}

              {/* Botón registrar visita */}
              {!modoEdicion && !confirmConvertir && !confirmEliminar && (
                <button onClick={() => { setModalProspecto(null); setVisitaProspecto(modalProspecto); setUbicacionObtenida(false); setFirmaGuardada(null); setNombreReceptor(''); setComentario(''); }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-sm hover:from-orange-500 hover:to-amber-600 transition-all shadow-sm">
                  <Plus size={16} /> Registrar visita
                </button>
              )}

              {/* Convertir */}
              {!modoEdicion && !confirmEliminar && (
                confirmConvertir ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-emerald-800 mb-3">¿Convertir a Médico Referente?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmConvertir(false)} className="flex-1 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                      <button onClick={convertirAReferente} disabled={convirtiendo} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60">
                        {convirtiendo ? 'Convirtiendo...' : '✓ Confirmar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmConvertir(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors">
                    <CheckCircle size={15} /> Convertir a Médico Referente
                  </button>
                )
              )}

              {/* Eliminar */}
              {!modoEdicion && !confirmConvertir && (
                confirmEliminar ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-800 mb-3">¿Eliminar este prospecto?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmEliminar(false)} className="flex-1 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                      <button onClick={eliminarProspecto} disabled={eliminando} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60">
                        {eliminando ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmEliminar(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-red-500 text-sm font-semibold hover:bg-red-50 rounded-xl transition-colors border border-red-100">
                    <Trash2 size={14} /> Eliminar prospecto
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VISITA PROSPECTO ────────────────────────────── */}
      {visitaProspecto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-900">Visita a Prospecto</h3>
              <button onClick={() => setVisitaProspecto(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                <p className="font-bold text-gray-900 text-sm">{visitaProspecto.nombre}</p>
                <p className="text-xs text-gray-500">{getNombreMun(visitaProspecto.municipio)}, {getNombreDepto(visitaProspecto.departamento)}</p>
              </div>

              {ubicacionObtenida ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-emerald-700">Ubicación capturada ✓</p>
                    <p className="text-xs text-emerald-500 font-mono">{latitud?.toFixed(5)}, {longitud?.toFixed(5)}</p>
                  </div>
                </div>
              ) : (
                <button onClick={obtenerUbicacion} disabled={obteniendoUbic}
                  className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-60">
                  {obteniendoUbic ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500" /> Obteniendo...</> : <><MapPin size={16} /> Obtener ubicación GPS</>}
                </button>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Recibido por *</label>
                <input type="text" value={nombreReceptor} onChange={e => setNombreReceptor(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                  placeholder="Ej: Dra. García / Recepcionista" />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                  <PenTool size={12} /> Firma del receptor *
                </label>
                {firmaGuardada ? (
                  <div className="border-2 border-emerald-200 rounded-xl overflow-hidden bg-emerald-50 relative">
                    <img src={firmaGuardada} alt="Firma" className="w-full h-20 object-contain" />
                    <div className="absolute top-2 left-3 flex items-center gap-1 bg-white/80 backdrop-blur rounded-lg px-2 py-0.5">
                      <CheckCircle size={12} className="text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">Firma OK</span>
                    </div>
                    <button onClick={() => setFirmaGuardada(null)} className="absolute top-2 right-2 bg-white border border-gray-200 text-gray-500 rounded-lg p-1.5 shadow-sm hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={abrirFirmaModal}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50 transition-all">
                    <PenTool size={16} /> Abrir panel de firma
                  </button>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                  <MessageSquare size={12} /> Observaciones
                </label>
                <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none resize-none"
                  placeholder="Seguimiento, intereses, próxima visita..." />
              </div>

              <div className="flex gap-2 text-xs">
                {[{ ok: ubicacionObtenida, label: 'GPS' }, { ok: !!firmaGuardada, label: 'Firma' }, { ok: !!nombreReceptor.trim(), label: 'Receptor' }].map(({ ok, label }) => (
                  <div key={label} className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-all ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {ok ? <CheckCircle size={11} /> : <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300" />}
                    {label}
                  </div>
                ))}
              </div>

              <button onClick={registrarVisitaProspecto}
                disabled={guardandoVisita || !ubicacionObtenida || !firmaGuardada || !nombreReceptor.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-sm hover:from-orange-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md">
                {guardandoVisita ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Registrando...</> : <><CheckCircle size={17} /> Registrar Visita</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FIRMA */}
      {showFirmaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900">✍️ Firma del receptor</h3>
                <p className="text-xs text-gray-400 mt-0.5">Dibuja con el dedo o el mouse</p>
              </div>
              <button onClick={() => setShowFirmaModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-4">
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative" style={{ touchAction: 'none' }}>
                <canvas ref={canvasRef} className="block w-full cursor-crosshair"
                  style={{ height: 200, touchAction: 'none', userSelect: 'none' }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                {firmaVacia && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="text-gray-300 text-sm font-medium select-none">Firma aquí →</p></div>}
              </div>
            </div>
            <div className="flex gap-3 px-4 pb-4">
              <button onClick={limpiarFirma} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50">🗑 Limpiar</button>
              <button onClick={confirmarFirma} disabled={firmaVacia}
                className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl text-sm font-bold hover:from-orange-500 hover:to-amber-600 disabled:opacity-40">✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
