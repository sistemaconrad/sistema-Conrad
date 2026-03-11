import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Plus, X, Search, CheckCircle,
  PenTool, Navigation, Stethoscope, MessageSquare, Eye, Filter, Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { departamentosGuatemala, municipiosGuatemala } from '../../data/guatemala';

interface Medico {
  id: string;
  nombre: string;
  especialidad?: string;
  departamento: string;
  municipio: string;
  direccion: string;
  clinica?: string;
  telefono: string;
}

interface Visita {
  id: string;
  medico_id: string;
  medico_nombre: string;
  medico_especialidad?: string;
  visitadora_nombre: string;
  latitud?: number;
  longitud?: number;
  firma_receptor?: string;
  nombre_receptor?: string;
  comentario?: string;
  created_at: string;
}

const CANVAS_W = 600;
const CANVAS_H = 260;

const getNombreDepto = (id: string) => departamentosGuatemala.find(d => d.id === id)?.nombre || id;
const getNombreMun   = (id: string) => municipiosGuatemala.find(m => m.id === id)?.nombre || id;

const toGT = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - 6 * 60 * 60 * 1000);
};

export const VisitasView: React.FC = () => {
  const [medicos, setMedicos]   = useState<Medico[]>([]);
  const [visitas, setVisitas]   = useState<Visita[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [medicoSeleccionado, setMedicoSeleccionado] = useState<Medico | null>(null);
  const [step, setStep]         = useState<1 | 2>(1);

  // Campos visita
  const [ubicacionObtenida, setUbicacionObtenida] = useState(false);
  const [latitud, setLatitud]   = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modal firma separado
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaGuardada, setFirmaGuardada]   = useState<string | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [dibujando, setDibujando] = useState(false);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Filtros
  const [filtroFecha, setFiltroFecha] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<Visita | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: med }, { data: vis }] = await Promise.all([
      supabase.from('medicos').select('*').eq('es_referente', true).eq('activo', true).order('nombre'),
      supabase.from('visitas_medicas').select('*').order('created_at', { ascending: false }).limit(100)
    ]);
    setMedicos(med || []);
    setVisitas(vis || []);
    setLoading(false);
  };

  // ── Canvas firma ───────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top)  * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDibujando(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dibujando || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setFirmaVacia(false);
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDibujando(false);
  };

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setFirmaVacia(true);
  };

  const confirmarFirma = () => {
    if (firmaVacia) { alert('Por favor dibuja la firma antes de confirmar'); return; }
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    setFirmaGuardada(dataUrl);
    setShowFirmaModal(false);
  };

  const abrirFirmaModal = () => {
    setFirmaVacia(true);
    setShowFirmaModal(true);
    // limpiar canvas al abrir
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d')!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    }, 50);
  };

  // ── GPS ────────────────────────────────────────────────────────
  const obtenerUbicacion = () => {
    if (!navigator.geolocation) { alert('Tu dispositivo no soporta geolocalización'); return; }
    setObteniendoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLatitud(pos.coords.latitude); setLongitud(pos.coords.longitude); setUbicacionObtenida(true); setObteniendoUbicacion(false); },
      ()  => { alert('No se pudo obtener la ubicación. Verifica los permisos.'); setObteniendoUbicacion(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ── Guardar visita ─────────────────────────────────────────────
  const registrarVisita = async () => {
    if (!medicoSeleccionado) return;
    if (!ubicacionObtenida)  { alert('Debes obtener la ubicación GPS'); return; }
    if (!firmaGuardada)      { alert('Debes obtener la firma del receptor'); return; }
    if (!nombreReceptor.trim()) { alert('Indica el nombre de quien recibió la visita'); return; }

    setGuardando(true);
    try {
      const visitadora = localStorage.getItem('nombreUsuarioConrad') || 'Visitadora';
      await supabase.from('visitas_medicas').insert([{
        medico_id: medicoSeleccionado.id,
        medico_nombre: medicoSeleccionado.nombre,
        medico_especialidad: medicoSeleccionado.especialidad || null,
        visitadora_nombre: visitadora,
        latitud, longitud,
        firma_receptor: firmaGuardada,
        nombre_receptor: nombreReceptor,
        comentario: comentario || null,
      }]);
      await cargarDatos();
      cerrarModal();
      alert('✅ Visita registrada exitosamente');
    } catch (err) {
      alert('Error al registrar la visita');
    }
    setGuardando(false);
  };

  const cerrarModal = () => {
    setShowModal(false); setStep(1); setMedicoSeleccionado(null);
    setBusqueda(''); setUbicacionObtenida(false); setLatitud(null); setLongitud(null);
    setNombreReceptor(''); setComentario(''); setFirmaGuardada(null);
  };

  const medicosFiltrados = medicos.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.especialidad || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const visitasFiltradas = filtroFecha
    ? visitas.filter(v => v.created_at.startsWith(filtroFecha))
    : visitas;

  const hoy = new Date().toISOString().split('T')[0];
  const visitasHoy = visitas.filter(v => v.created_at.startsWith(hoy)).length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Hoy</p>
          <p className="text-2xl font-bold text-pink-600">{visitasHoy}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-800">{visitas.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Médicos</p>
          <p className="text-2xl font-bold text-gray-800">{new Set(visitas.map(v => v.medico_id)).size}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 mb-4 items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Filter size={14} className="text-gray-400 shrink-0" />
          <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1 max-w-xs" />
          {filtroFecha && (
            <button onClick={() => setFiltroFecha('')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2.5 rounded-xl hover:bg-pink-700 transition-colors text-sm font-semibold shadow-sm">
          <Plus size={16} /> Nueva Visita
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" /></div>
        ) : visitasFiltradas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MapPin size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium text-gray-500">No hay visitas registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visitasFiltradas.map(v => {
              const dt = toGT(v.created_at);
              return (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-pink-50/30 active:bg-pink-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-2 shrink-0">
                      <Stethoscope size={15} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{v.medico_nombre}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {dt.toLocaleDateString('es-GT')} · {dt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                        {v.nombre_receptor && ` · ${v.nombre_receptor}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {v.latitud && (
                      <a href={`https://maps.google.com/?q=${v.latitud},${v.longitud}`} target="_blank" rel="noreferrer"
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Navigation size={15} />
                      </a>
                    )}
                    <button onClick={() => setVistaDetalle(v)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <Eye size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ MODAL NUEVA VISITA ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {step === 1 ? '📋 Selecciona el médico' : `✅ Detalles de visita`}
                </h2>
                {step === 2 && <p className="text-xs text-pink-600 font-medium">{medicoSeleccionado?.nombre}</p>}
              </div>
              <button onClick={cerrarModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pb-6 pt-4">
              {/* PASO 1 */}
              {step === 1 && (
                <div>
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar médico..." value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500" />
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {medicosFiltrados.map(m => (
                      <button key={m.id} onClick={() => { setMedicoSeleccionado(m); setStep(2); }}
                        className="w-full text-left p-3.5 border border-gray-100 rounded-xl hover:border-pink-300 hover:bg-pink-50 active:bg-pink-100 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="bg-pink-100 rounded-xl p-2 shrink-0">
                            <Stethoscope size={16} className="text-pink-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{m.nombre}</p>
                            <p className="text-xs text-gray-400">
                              {m.especialidad && `${m.especialidad} · `}
                              {getNombreMun(m.municipio)}, {getNombreDepto(m.departamento)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {medicosFiltrados.length === 0 && (
                      <div className="text-center py-10 text-gray-400">
                        <Stethoscope size={32} className="mx-auto mb-2 text-gray-200" />
                        <p className="text-sm">No se encontraron médicos</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PASO 2 */}
              {step === 2 && medicoSeleccionado && (
                <div className="space-y-4">
                  {/* Info médico */}
                  <div className="bg-pink-50 rounded-xl p-3.5 border border-pink-100 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{medicoSeleccionado.nombre}</p>
                      {medicoSeleccionado.clinica && <p className="text-xs text-gray-500">{medicoSeleccionado.clinica}</p>}
                      <p className="text-xs text-gray-400">{medicoSeleccionado.direccion}</p>
                    </div>
                    <button onClick={() => { setStep(1); setUbicacionObtenida(false); setFirmaGuardada(null); }}
                      className="text-xs text-pink-600 hover:underline shrink-0 ml-2">Cambiar</button>
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
                    <button onClick={obtenerUbicacion} disabled={obteniendoUbicacion}
                      className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50 active:bg-pink-100 transition-all disabled:opacity-60">
                      {obteniendoUbicacion
                        ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600" /> Obteniendo ubicación...</>
                        : <><MapPin size={16} /> 📍 Obtener mi ubicación</>}
                    </button>
                  )}

                  {/* Receptor */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de quien recibió *</label>
                    <input type="text" value={nombreReceptor} onChange={e => setNombreReceptor(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
                      placeholder="Ej: Dra. García, Recepcionista..." />
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
                      <button onClick={abrirFirmaModal}
                        className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50 active:bg-pink-100 transition-all">
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
                      placeholder="Observaciones, seguimiento, intereses..." />
                  </div>

                  <button onClick={registrarVisita}
                    disabled={guardando || !ubicacionObtenida || !firmaGuardada || !nombreReceptor.trim()}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-pink-600 text-white rounded-xl font-bold text-sm hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                    {guardando
                      ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Registrando...</>
                      : <><CheckCircle size={17} /> Registrar Visita</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL FIRMA (pantalla completa en móvil) ═══ */}
      {showFirmaModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800">✍️ Firma del receptor</h3>
                <p className="text-xs text-gray-400 mt-0.5">Dibuja la firma en el área de abajo</p>
              </div>
              <button onClick={() => setShowFirmaModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {/* Canvas área */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative touch-none"
                style={{ touchAction: 'none' }}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="w-full cursor-crosshair block"
                  style={{ touchAction: 'none', userSelect: 'none' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {firmaVacia && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-300 text-sm font-medium">Firma aquí →</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">Usa el dedo o el mouse para firmar</p>
            </div>

            <div className="flex gap-3 px-4 pb-4">
              <button onClick={limpiarFirma}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100">
                🗑 Limpiar
              </button>
              <button onClick={confirmarFirma} disabled={firmaVacia}
                className="flex-1 py-3 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 disabled:opacity-40 transition-colors">
                ✓ Confirmar Firma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL DETALLE ═══ */}
      {vistaDetalle && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl">
              <h2 className="font-bold text-gray-800">Detalle de Visita</h2>
              <button onClick={() => setVistaDetalle(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-pink-50 rounded-xl p-4">
                <p className="font-bold text-gray-900">{vistaDetalle.medico_nombre}</p>
                {vistaDetalle.medico_especialidad && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-pink-200 text-pink-800 mt-1">
                    {vistaDetalle.medico_especialidad}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Visitadora',  value: vistaDetalle.visitadora_nombre },
                  { label: 'Receptor',    value: vistaDetalle.nombre_receptor },
                  { label: 'Fecha',       value: toGT(vistaDetalle.created_at).toLocaleDateString('es-GT') },
                  { label: 'Hora (GT)',   value: toGT(vistaDetalle.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
              {vistaDetalle.comentario && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Comentario</p>
                  <p className="text-sm text-gray-700">{vistaDetalle.comentario}</p>
                </div>
              )}
              {vistaDetalle.latitud && (
                <a href={`https://maps.google.com/?q=${vistaDetalle.latitud},${vistaDetalle.longitud}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium px-4 py-3 rounded-xl hover:bg-blue-100">
                  <Navigation size={16} /> Ver ubicación en Google Maps
                </a>
              )}
              {vistaDetalle.firma_receptor && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Firma del receptor</p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                    <img src={vistaDetalle.firma_receptor} alt="Firma" className="w-full" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};