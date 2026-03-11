import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus, Stethoscope, MapPin, Phone, Star, Clock, Search, X,
  ChevronRight, AlertCircle, CheckCircle, Trash2, Navigation,
  PenTool, MapPinIcon, MessageSquare, Plus, Edit2, Save
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

// Canvas toma el tamaño real del contenedor (dinámico)
const getNombreDepto = (id: string) => departamentosGuatemala.find(d => d.id === id)?.nombre || id;
const getNombreMun   = (id: string) => municipiosGuatemala.find(m => m.id === id)?.nombre || id;

export const ProspectosView: React.FC = () => {
  const [prospectos, setProspectos] = useState<Medico[]>([]);
  const [visitas, setVisitas]       = useState<VisitaProspecto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [eliminando, setEliminando]     = useState(false);

  // Modal detalle
  const [modalProspecto, setModalProspecto] = useState<Medico | null>(null);
  const [confirmConvertir, setConfirmConvertir] = useState(false);
  const [confirmEliminar, setConfirmEliminar]   = useState(false);
  const [modoEdicion, setModoEdicion]           = useState(false);
  const [editNombre, setEditNombre]             = useState('');
  const [editTelefono, setEditTelefono]         = useState('');
  const [editDireccion, setEditDireccion]       = useState('');
  const [editClinica, setEditClinica]           = useState('');
  const [guardandoEdit, setGuardandoEdit]       = useState(false);

  // Modal visita
  const [visitaProspecto, setVisitaProspecto] = useState<Medico | null>(null);
  const [ubicacionObtenida, setUbicacionObtenida] = useState(false);
  const [latitud, setLatitud]     = useState<number | null>(null);
  const [longitud, setLongitud]   = useState<number | null>(null);
  const [obteniendoUbic, setObteniendoUbic] = useState(false);
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [comentario, setComentario]         = useState('');
  const [guardandoVisita, setGuardandoVisita] = useState(false);

  // Modal firma
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaGuardada, setFirmaGuardada]   = useState<string | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [dibujando, setDibujando] = useState(false);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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

  // ── Canvas firma ───────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Sin escalado: el canvas ahora tiene el mismo tamaño que su contenedor
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
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
  const limpiarFirma = () => { canvasRef.current?.getContext('2d')!.clearRect(0, 0, canvasRef.current?.width || 600, canvasRef.current?.height || 200); setFirmaVacia(true); };
  const confirmarFirma = () => {
    if (firmaVacia) { alert('Por favor dibuja la firma'); return; }
    setFirmaGuardada(canvasRef.current!.toDataURL('image/png'));
    setShowFirmaModal(false);
  };
  const sizearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    canvas.width = container.clientWidth;
    canvas.height = 200;
  };

  const abrirFirma = () => {
    setFirmaVacia(true);
    setShowFirmaModal(true);
    setTimeout(() => { sizearCanvas(); canvasRef.current?.getContext('2d')!.clearRect(0, 0, canvasRef.current?.width || 600, canvasRef.current?.height || 200); }, 100);
  };

  // ── GPS ────────────────────────────────────────────────────────
  const obtenerUbicacion = () => {
    if (!navigator.geolocation) { alert('Sin soporte de geolocalización'); return; }
    setObteniendoUbic(true);
    navigator.geolocation.getCurrentPosition(
      p => { setLatitud(p.coords.latitude); setLongitud(p.coords.longitude); setUbicacionObtenida(true); setObteniendoUbic(false); },
      () => { alert('No se pudo obtener ubicación'); setObteniendoUbic(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ── Guardar visita ─────────────────────────────────────────────
  const registrarVisita = async () => {
    if (!visitaProspecto) return;
    if (!ubicacionObtenida) { alert('Debes obtener la ubicación GPS'); return; }
    if (!firmaGuardada) { alert('Se requiere la firma del receptor'); return; }
    if (!nombreReceptor.trim()) { alert('Indica el nombre de quien recibió'); return; }
    setGuardandoVisita(true);
    try {
      const visitadora = localStorage.getItem('nombreUsuarioConrad') || 'Visitadora';
      await supabase.from('visitas_medicas').insert([{
        medico_id: visitaProspecto.id, medico_nombre: visitaProspecto.nombre,
        medico_especialidad: visitaProspecto.especialidad || null,
        visitadora_nombre: visitadora, latitud, longitud,
        firma_receptor: firmaGuardada, nombre_receptor: nombreReceptor,
        comentario: comentario || null,
      }]);
      await cargarDatos();
      cerrarVisitaModal();
      alert(`✅ Visita registrada para ${visitaProspecto.nombre}`);
    } catch (e: any) { alert('Error: ' + e.message); }
    setGuardandoVisita(false);
  };

  const cerrarVisitaModal = () => {
    setVisitaProspecto(null); setUbicacionObtenida(false); setLatitud(null); setLongitud(null);
    setNombreReceptor(''); setComentario(''); setFirmaGuardada(null);
  };

  const abrirVisita = (m: Medico) => {
    cerrarVisitaModal();
    setVisitaProspecto(m);
    setModalProspecto(null);
  };

  // ── Convertir / Eliminar ───────────────────────────────────────
  const abrirEdicion = (m: Medico) => {
    setEditNombre(m.nombre);
    setEditTelefono(m.telefono || '');
    setEditDireccion(m.direccion || '');
    setEditClinica(m.clinica || '');
    setModoEdicion(true);
  };

  const guardarEdicion = async () => {
    if (!modalProspecto || !editNombre.trim()) { alert('El nombre es obligatorio'); return; }
    setGuardandoEdit(true);
    try {
      await supabase.from('medicos').update({
        nombre: editNombre.trim(),
        telefono: editTelefono.trim(),
        direccion: editDireccion.trim(),
        clinica: editClinica.trim() || null,
      }).eq('id', modalProspecto.id);
      await cargarDatos();
      // Update local modal state
      setModalProspecto({ ...modalProspecto,
        nombre: editNombre.trim(), telefono: editTelefono.trim(),
        direccion: editDireccion.trim(), clinica: editClinica.trim() || undefined,
      });
      setModoEdicion(false);
    } catch (e: any) { alert('Error al guardar: ' + e.message); }
    setGuardandoEdit(false);
  };

  const convertirAReferente = async (m: Medico) => {
    setConvirtiendo(true);
    try {
      await supabase.from('medicos').update({ es_referente: true }).eq('id', m.id);
      await cargarDatos();
      setModalProspecto(null); setConfirmConvertir(false);
      alert(`✅ ${m.nombre} ahora es médico referente`);
    } catch (e: any) { alert('Error: ' + e.message); }
    setConvirtiendo(false);
  };

  const eliminarProspecto = async (m: Medico) => {
    setEliminando(true);
    try {
      await supabase.from('medicos').update({ activo: false }).eq('id', m.id);
      await cargarDatos();
      setModalProspecto(null); setConfirmEliminar(false);
    } catch (e: any) { alert('Error: ' + e.message); }
    setEliminando(false);
  };

  const filtrados = prospectos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.especialidad || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    getNombreDepto(p.departamento).toLowerCase().includes(busqueda.toLowerCase())
  );
  const visitados  = filtrados.filter(p => visitasDe(p.id).length > 0);
  const sinVisitar = filtrados.filter(p => visitasDe(p.id).length === 0);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { v: sinVisitar.length, label: 'Sin visitar', color: 'text-orange-500' },
          { v: visitados.length,  label: 'Visitados',   color: 'text-blue-600' },
          { v: prospectos.length, label: 'Total',        color: 'text-gray-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.v}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-4 shadow-sm">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input type="text" placeholder="Buscar por nombre, especialidad o departamento..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="flex-1 text-sm text-gray-700 focus:outline-none placeholder-gray-300" />
        {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserPlus size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No hay prospectos registrados</p>
          <p className="text-sm mt-1">Los médicos "No Referente" aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sinVisitar.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-orange-500" />
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Pendientes de visita ({sinVisitar.length})</span>
              </div>
              <div className="space-y-2">
                {sinVisitar.map(p => (
                  <Tarjeta key={p.id} medico={p} visitas={[]}
                    onDetalle={() => setModalProspecto(p)}
                    onVisitar={() => abrirVisita(p)} />
                ))}
              </div>
            </div>
          )}
          {visitados.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Ya visitados ({visitados.length})</span>
              </div>
              <div className="space-y-2">
                {visitados.map(p => (
                  <Tarjeta key={p.id} medico={p} visitas={visitasDe(p.id)}
                    onDetalle={() => setModalProspecto(p)}
                    onVisitar={() => abrirVisita(p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODAL DETALLE ═══ */}
      {modalProspecto && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <h2 className="font-bold text-gray-800">{modoEdicion ? '✏️ Editar Prospecto' : 'Prospecto'}</h2>
              <div className="flex items-center gap-1">
                {!modoEdicion && (
                  <button onClick={() => abrirEdicion(modalProspecto)}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl" title="Editar">
                    <Edit2 size={17} />
                  </button>
                )}
                <button onClick={() => { setModalProspecto(null); setConfirmConvertir(false); setConfirmEliminar(false); setModoEdicion(false); }}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">

              {/* ── MODO EDICIÓN ── */}
              {modoEdicion ? (
                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium">Editando datos de {modalProspecto.nombre}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                    <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
                    <input type="text" value={editTelefono} onChange={e => setEditTelefono(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      placeholder="55551234" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Clínica / Centro</label>
                    <input type="text" value={editClinica} onChange={e => setEditClinica(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      placeholder="Nombre de la clínica u hospital" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección</label>
                    <textarea value={editDireccion} onChange={e => setEditDireccion(e.target.value)} rows={2}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
                      placeholder="Dirección exacta..." />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setModoEdicion(false)}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={guardarEdicion} disabled={guardandoEdit}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700">
                      <Save size={15} /> {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              ) : (
              <>
              {/* ── MODO VISTA ── */}
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                <div className="flex items-start gap-3">
                  <div className="bg-orange-100 rounded-xl p-2 shrink-0"><Stethoscope size={20} className="text-orange-600" /></div>
                  <div>
                    <p className="font-bold text-gray-900">{modalProspecto.nombre}</p>
                    {modalProspecto.especialidad && (
                      <span className="inline-block bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full mt-1">{modalProspecto.especialidad}</span>
                    )}
                    {modalProspecto.clinica && <p className="text-sm text-gray-600 mt-1">{modalProspecto.clinica}</p>}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <Phone size={15} className="text-gray-400 shrink-0" />
                  <div><p className="text-xs text-gray-400">Teléfono</p>
                    <a href={`tel:${modalProspecto.telefono}`} className="text-sm font-semibold text-blue-600">{modalProspecto.telefono || 'N/A'}</a></div>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <MapPin size={15} className="text-gray-400 shrink-0" />
                  <div><p className="text-xs text-gray-400">Ubicación</p>
                    <p className="text-sm font-semibold text-gray-800">{getNombreMun(modalProspecto.municipio)}, {getNombreDepto(modalProspecto.departamento)}</p>
                    {modalProspecto.direccion && <p className="text-xs text-gray-500 mt-0.5">{modalProspecto.direccion}</p>}</div>
                </div>
              </div>

              {/* Historial */}
              {visitasDe(modalProspecto.id).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Visitas ({visitasDe(modalProspecto.id).length})</p>
                  <div className="space-y-2">
                    {visitasDe(modalProspecto.id).map(v => (
                      <div key={v.id} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={13} className="text-emerald-600" />
                          <p className="text-xs font-medium text-emerald-700">{v.visitadora_nombre}</p>
                          <p className="text-xs text-gray-400 ml-auto">{new Date(v.created_at).toLocaleDateString('es-GT')}</p>
                        </div>
                        {v.comentario && <p className="text-xs text-gray-600 mt-1 ml-5">{v.comentario}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                {/* Botón visitar */}
                <button onClick={() => abrirVisita(modalProspecto)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl font-bold text-sm hover:bg-pink-700 transition-all shadow-sm">
                  <MapPinIcon size={16} /> Registrar Visita
                </button>

                {/* Convertir */}
                {!confirmConvertir && !confirmEliminar && (
                  <button onClick={() => setConfirmConvertir(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm">
                    <Star size={16} /> Convertir a Médico Referente
                  </button>
                )}
                {confirmConvertir && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-1 text-center">¿Confirmar conversión?</p>
                    <p className="text-xs text-gray-500 text-center mb-3">{modalProspecto.nombre} generará comisiones desde ahora</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmConvertir(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancelar</button>
                      <button onClick={() => convertirAReferente(modalProspecto)} disabled={convirtiendo}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                        {convirtiendo ? 'Convirtiendo...' : '✓ Confirmar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Eliminar */}
                {!confirmConvertir && !confirmEliminar && (
                  <button onClick={() => setConfirmEliminar(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-all">
                    <Trash2 size={15} /> Eliminar prospecto
                  </button>
                )}
                {confirmEliminar && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-1 text-center">¿Eliminar este prospecto?</p>
                    <p className="text-xs text-gray-500 text-center mb-3">Esta acción no se puede deshacer</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmEliminar(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancelar</button>
                      <button onClick={() => eliminarProspecto(modalProspecto)} disabled={eliminando}
                        className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                        {eliminando ? 'Eliminando...' : '🗑 Eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL REGISTRAR VISITA ═══ */}
      {visitaProspecto && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-bold text-gray-800">📋 Registrar Visita</h2>
                <p className="text-xs text-pink-600 font-medium">{visitaProspecto.nombre}</p>
              </div>
              <button onClick={cerrarVisitaModal} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="px-5 pb-6 pt-4 space-y-4">
              {/* Info médico */}
              <div className="bg-pink-50 rounded-xl p-3.5 border border-pink-100">
                <p className="font-bold text-gray-900 text-sm">{visitaProspecto.nombre}</p>
                {visitaProspecto.clinica && <p className="text-xs text-gray-500">{visitaProspecto.clinica}</p>}
                <p className="text-xs text-gray-400">{visitaProspecto.direccion} · {getNombreMun(visitaProspecto.municipio)}</p>
              </div>

              {/* GPS */}
              {ubicacionObtenida ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle size={18} className="text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Ubicación obtenida ✓</p>
                    <p className="text-xs text-green-500">{latitud?.toFixed(5)}, {longitud?.toFixed(5)}</p>
                  </div>
                </div>
              ) : (
                <button onClick={obtenerUbicacion} disabled={obteniendoUbic}
                  className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50 transition-all disabled:opacity-60">
                  {obteniendoUbic ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600" /> Obteniendo...</>
                    : <><MapPin size={16} /> 📍 Obtener mi ubicación</>}
                </button>
              )}

              {/* Receptor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de quien recibió *</label>
                <input type="text" value={nombreReceptor} onChange={e => setNombreReceptor(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                  placeholder="Ej: Recepcionista, secretaria..." />
              </div>

              {/* Firma */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <PenTool size={13} /> Firma del receptor *
                </label>
                {firmaGuardada ? (
                  <div className="border border-green-200 rounded-xl overflow-hidden bg-green-50 relative">
                    <img src={firmaGuardada} alt="Firma" className="w-full h-20 object-contain" />
                    <div className="absolute inset-0 flex items-center justify-end p-2">
                      <button onClick={() => setFirmaGuardada(null)}
                        className="bg-white border border-gray-200 text-gray-500 rounded-lg p-1.5 shadow-sm hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="absolute top-2 left-3 flex items-center gap-1">
                      <CheckCircle size={14} className="text-green-600" />
                      <span className="text-xs font-semibold text-green-700">Firma obtenida</span>
                    </div>
                  </div>
                ) : (
                  <button onClick={abrirFirma}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50 transition-all">
                    <PenTool size={16} /> ✍️ Abrir panel de firma
                  </button>
                )}
              </div>

              {/* Comentario */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <MessageSquare size={13} /> Comentarios
                </label>
                <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 resize-none"
                  placeholder="Observaciones, interés del médico, seguimiento..." />
              </div>

              <button onClick={registrarVisita}
                disabled={guardandoVisita || !ubicacionObtenida || !firmaGuardada || !nombreReceptor.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 bg-pink-600 text-white rounded-xl font-bold text-sm hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                {guardandoVisita ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Registrando...</>
                  : <><CheckCircle size={17} /> Registrar Visita</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL FIRMA ═══ */}
      {showFirmaModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800">✍️ Firma del receptor</h3>
                <p className="text-xs text-gray-400 mt-0.5">Dibuja la firma en el área de abajo</p>
              </div>
              <button onClick={() => setShowFirmaModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-4">
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative" style={{ touchAction: 'none' }}>
                <canvas ref={canvasRef} className="block w-full cursor-crosshair" style={{ height: 200, touchAction: 'none', userSelect: 'none' }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                {firmaVacia && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-300 text-sm font-medium">Firma aquí →</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">Usa el dedo o el mouse para firmar</p>
            </div>
            <div className="flex gap-3 px-4 pb-4">
              <button onClick={limpiarFirma} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">🗑 Limpiar</button>
              <button onClick={confirmarFirma} disabled={firmaVacia}
                className="flex-1 py-3 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 disabled:opacity-40">✓ Confirmar Firma</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tarjeta compacta ──────────────────────────────────────────────────────────
const Tarjeta: React.FC<{
  medico: Medico; visitas: VisitaProspecto[];
  onDetalle: () => void; onVisitar: () => void;
}> = ({ medico, visitas, onDetalle, onVisitar }) => {
  const yaVisitado = visitas.length > 0;
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${yaVisitado ? 'border-emerald-100' : 'border-orange-100'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`rounded-xl p-2 shrink-0 ${yaVisitado ? 'bg-emerald-100' : 'bg-orange-100'}`}>
          {yaVisitado ? <CheckCircle size={18} className="text-emerald-600" /> : <Clock size={18} className="text-orange-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{medico.nombre}</p>
          <p className="text-xs text-gray-400 truncate">
            {medico.especialidad && `${medico.especialidad} · `}
            {getNombreMun(medico.municipio)}, {getNombreDepto(medico.departamento)}
          </p>
          {yaVisitado && visitas[0] && (
            <p className="text-xs text-emerald-600 mt-0.5">
              ✓ {new Date(visitas[0].created_at).toLocaleDateString('es-GT')} · {visitas.length} visita{visitas.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onVisitar}
            className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-xl text-xs font-bold hover:bg-pink-700 transition-all shadow-sm">
            <Plus size={12} /> Visitar
          </button>
          <button onClick={onDetalle} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {yaVisitado && <div className="h-0.5 bg-emerald-200" />}
    </div>
  );
};