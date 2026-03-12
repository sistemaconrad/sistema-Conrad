import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Plus, X, Search, CheckCircle,
  PenTool, Navigation, Stethoscope, MessageSquare, Eye,
  Trash2, Clock, Calendar, TrendingUp, Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { departamentosGuatemala, municipiosGuatemala } from '../../data/guatemala';

interface Medico {
  id: string; nombre: string; especialidad?: string;
  departamento: string; municipio: string; direccion: string;
  clinica?: string; telefono: string;
}
interface Visita {
  id: string; medico_id: string; medico_nombre: string;
  medico_especialidad?: string; visitadora_nombre: string;
  latitud?: number; longitud?: number; firma_receptor?: string;
  nombre_receptor?: string; comentario?: string; created_at: string;
}

const getNombreDepto = (id: string) => departamentosGuatemala.find(d => d.id === id)?.nombre || id;
const getNombreMun   = (id: string) => municipiosGuatemala.find(m => m.id === id)?.nombre || id;

// ✅ Hora Guatemala correcta usando timeZone explícito
const formatFechaGT = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' });
const formatHoraGT = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: true });
const fechaLocalGT = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

export const VisitasView: React.FC = () => {
  const [medicos, setMedicos]   = useState<Medico[]>([]);
  const [visitas, setVisitas]   = useState<Visita[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [medicoSeleccionado, setMedicoSeleccionado] = useState<Medico | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [ubicacionObtenida, setUbicacionObtenida] = useState(false);
  const [latitud, setLatitud]   = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaGuardada, setFirmaGuardada] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dibujando, setDibujando] = useState(false);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [vistaDetalle, setVistaDetalle] = useState<Visita | null>(null);
  const [fechaVer, setFechaVer] = useState<string>(''); // vacío = hoy

  useEffect(() => { cargarDatos(); }, [fechaVer]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: med }, { data: vis }] = await Promise.all([
      supabase.from('medicos').select('*').eq('es_referente', true).eq('activo', true).order('nombre'),
(() => {
        // Inicio y fin del día seleccionado en zona GT (UTC-6 = +6h a UTC)
        const diaGT = fechaVer || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
        const inicioDiaUTC = new Date(diaGT + 'T06:00:00.000Z');
        const finDiaUTC    = new Date(inicioDiaUTC.getTime() + 24 * 60 * 60 * 1000);
        return supabase.from('visitas_medicas').select('*')
          .gte('created_at', inicioDiaUTC.toISOString())
          .lt('created_at', finDiaUTC.toISOString())
          .order('created_at', { ascending: false });
      })()
    ]);
    setMedicos(med || []);
    setVisitas(vis || []);
    setLoading(false);
  };

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
  const limpiarFirma = () => { const c = canvasRef.current; if (c) { c.getContext('2d')!.clearRect(0,0,c.width,c.height); setFirmaVacia(true); } };
  const confirmarFirma = () => { if (firmaVacia) { alert('Dibuja la firma primero'); return; } setFirmaGuardada(canvasRef.current!.toDataURL('image/png')); setShowFirmaModal(false); };
  const sizearCanvas = () => { const c = canvasRef.current; if (!c) return; const p = c.parentElement; if (!p) return; c.width = p.clientWidth; c.height = 200; };
  const abrirFirmaModal = () => { setFirmaVacia(true); setShowFirmaModal(true); setTimeout(() => { sizearCanvas(); const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0,0,c.width,c.height); }, 80); };
  const obtenerUbicacion = () => {
    if (!navigator.geolocation) { alert('Sin soporte GPS'); return; }
    setObteniendoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      p => { setLatitud(p.coords.latitude); setLongitud(p.coords.longitude); setUbicacionObtenida(true); setObteniendoUbicacion(false); },
      ()  => { alert('No se pudo obtener ubicación'); setObteniendoUbicacion(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };
  const registrarVisita = async () => {
    if (!medicoSeleccionado) return;
    if (!ubicacionObtenida) { alert('Debes obtener la ubicación GPS'); return; }
    if (!firmaGuardada) { alert('Debes obtener la firma'); return; }
    if (!nombreReceptor.trim()) { alert('Indica quién recibió la visita'); return; }
    setGuardando(true);
    try {
      const visitadora = localStorage.getItem('nombreUsuarioConrad') || 'Visitadora';
      await supabase.from('visitas_medicas').insert([{ medico_id: medicoSeleccionado.id, medico_nombre: medicoSeleccionado.nombre, medico_especialidad: medicoSeleccionado.especialidad || null, visitadora_nombre: visitadora, latitud, longitud, firma_receptor: firmaGuardada, nombre_receptor: nombreReceptor, comentario: comentario || null }]);
      await cargarDatos(); cerrarModal(); alert('✅ Visita registrada');
    } catch { alert('Error al registrar la visita'); }
    setGuardando(false);
  };
  const cerrarModal = () => { setShowModal(false); setStep(1); setMedicoSeleccionado(null); setBusqueda(''); setUbicacionObtenida(false); setLatitud(null); setLongitud(null); setNombreReceptor(''); setComentario(''); setFirmaGuardada(null); };

  const medicosFiltrados = medicos.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (m.especialidad||'').toLowerCase().includes(busqueda.toLowerCase()));
  const hoyGT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const visitasFiltradas = visitas; // filtradas por fechaVer (o hoy) desde la query
  const visitasHoy = visitas.filter(v => fechaLocalGT(v.created_at) === hoyGT).length;
  const medicosUnicos = new Set(visitas.map(v => v.medico_id)).size;

  // Agrupar por fecha GT
  const visitasPorFecha: Record<string, Visita[]> = {};
  visitasFiltradas.forEach(v => { const f = fechaLocalGT(v.created_at); if (!visitasPorFecha[f]) visitasPorFecha[f] = []; visitasPorFecha[f].push(v); });
  const fechasOrdenadas = Object.keys(visitasPorFecha).sort((a,b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-4 text-white shadow-lg shadow-pink-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-pink-100 text-xs font-semibold uppercase tracking-wide">Hoy</p>
            <div className="bg-white/20 rounded-lg p-1"><Clock size={13} className="text-white" /></div>
          </div>
          <p className="text-3xl font-black">{visitasHoy}</p>
          <p className="text-pink-100 text-xs mt-0.5">visitas hoy</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Total</p>
            <div className="bg-slate-100 rounded-lg p-1"><TrendingUp size={13} className="text-slate-500" /></div>
          </div>
          <p className="text-3xl font-black text-slate-800">{visitas.length}</p>
          <p className="text-gray-400 text-xs mt-0.5">registradas</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Médicos</p>
            <div className="bg-slate-100 rounded-lg p-1"><Users size={13} className="text-slate-500" /></div>
          </div>
          <p className="text-3xl font-black text-slate-800">{medicosUnicos}</p>
          <p className="text-gray-400 text-xs mt-0.5">visitados</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-2 flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm">
          <Calendar size={14} className="text-pink-400 shrink-0" />
          <input type="date" value={fechaVer}
            max={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })}
            onChange={e => setFechaVer(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-gray-700" />
          {fechaVer && (
            <button onClick={() => setFechaVer('')}
              className="text-xs text-pink-500 hover:text-pink-700 font-semibold shrink-0 flex items-center gap-1">
              <X size={12} /> Hoy
            </button>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white px-5 py-2.5 rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all text-sm font-bold shadow-md shadow-pink-200 shrink-0">
          <Plus size={16} /> Nueva Visita
        </button>
      </div>

      {/* Lista timeline */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
          <p className="text-sm text-gray-400">Cargando visitas...</p>
        </div>
      ) : visitasFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-16 shadow-sm">
          <div className="bg-pink-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <MapPin size={28} className="text-pink-300" />
          </div>
          <p className="font-semibold text-gray-500">Sin visitas registradas</p>
          <p className="text-sm text-gray-400 mt-1">Aún no hay visitas registradas hoy</p>
        </div>
      ) : (
        <div className="space-y-5">
          {fechasOrdenadas.map(fecha => (
            <div key={fecha}>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-slate-100 rounded-lg px-3 py-1">
                  <p className="text-xs font-bold text-slate-600">
                    {new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">{visitasPorFecha[fecha].length} visita{visitasPorFecha[fecha].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {visitasPorFecha[fecha].map(v => (
                  <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-pink-100 transition-all overflow-hidden group">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0 shadow-sm">
                        <Stethoscope size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{v.medico_nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} /> {formatHoraGT(v.created_at)}
                          </span>
                          {v.nombre_receptor && (<><span className="text-gray-200">·</span><span className="text-xs text-gray-400 truncate">{v.nombre_receptor}</span></>)}
                          {v.medico_especialidad && <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-medium">{v.medico_especialidad}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                        {v.latitud && (
                          <a href={`https://maps.google.com/?q=${v.latitud},${v.longitud}`} target="_blank" rel="noreferrer"
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                            <Navigation size={15} />
                          </a>
                        )}
                        <button onClick={() => setVistaDetalle(v)} className="p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl transition-colors">
                          <Eye size={15} />
                        </button>
                      </div>
                    </div>
                    {v.comentario && (
                      <div className="px-4 pb-3 -mt-1">
                        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 truncate">💬 {v.comentario}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVA VISITA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-2">
                  <Stethoscope size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">{step === 1 ? 'Seleccionar médico' : 'Detalles de la visita'}</h2>
                  {step === 2 && <p className="text-xs text-pink-600 font-medium truncate">{medicoSeleccionado?.nombre}</p>}
                </div>
              </div>
              <button onClick={cerrarModal} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="px-5 pb-6 pt-4">
              {step === 1 && (
                <div>
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar médico por nombre o especialidad..." value={busqueda}
                      onChange={e => setBusqueda(e.target.value)} autoFocus
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-400 focus:border-transparent outline-none" />
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {medicosFiltrados.map(m => (
                      <button key={m.id} onClick={() => { setMedicoSeleccionado(m); setStep(2); }}
                        className="w-full text-left p-3.5 border border-gray-100 rounded-xl hover:border-pink-200 hover:bg-pink-50/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-pink-100 to-rose-100 rounded-xl p-2 shrink-0">
                            <Stethoscope size={15} className="text-pink-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm truncate">{m.nombre}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {m.especialidad && <span className="text-pink-500 font-medium">{m.especialidad} · </span>}
                              {getNombreMun(m.municipio)}, {getNombreDepto(m.departamento)}
                            </p>
                          </div>
                          <span className="text-gray-300 text-lg">›</span>
                        </div>
                      </button>
                    ))}
                    {medicosFiltrados.length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <Stethoscope size={32} className="mx-auto mb-2 text-gray-200" />
                        <p className="text-sm font-medium">Sin resultados</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {step === 2 && medicoSeleccionado && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{medicoSeleccionado.nombre}</p>
                      {medicoSeleccionado.especialidad && <span className="inline-block text-xs bg-pink-200 text-pink-800 px-2 py-0.5 rounded-full font-medium mt-1">{medicoSeleccionado.especialidad}</span>}
                      {medicoSeleccionado.clinica && <p className="text-xs text-gray-500 mt-1">{medicoSeleccionado.clinica}</p>}
                      <p className="text-xs text-gray-400">{medicoSeleccionado.direccion}</p>
                    </div>
                    <button onClick={() => { setStep(1); setUbicacionObtenida(false); setFirmaGuardada(null); }}
                      className="text-xs text-pink-600 hover:underline font-semibold shrink-0">Cambiar</button>
                  </div>
                  {ubicacionObtenida ? (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <div className="bg-emerald-100 rounded-lg p-1.5"><CheckCircle size={16} className="text-emerald-600" /></div>
                      <div>
                        <p className="text-sm font-bold text-emerald-700">Ubicación capturada ✓</p>
                        <p className="text-xs text-emerald-500 font-mono">{latitud?.toFixed(5)}, {longitud?.toFixed(5)}</p>
                      </div>
                    </div>
                  ) : (
                    <button onClick={obtenerUbicacion} disabled={obteniendoUbicacion}
                      className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-all disabled:opacity-60">
                      {obteniendoUbicacion ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-500" /> Obteniendo...</> : <><MapPin size={16} /> 📍 Obtener ubicación GPS</>}
                    </button>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Recibido por *</label>
                    <input type="text" value={nombreReceptor} onChange={e => setNombreReceptor(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-400 outline-none"
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
                        className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-all">
                        <PenTool size={16} /> ✍️ Abrir panel de firma
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                      <MessageSquare size={12} /> Observaciones
                    </label>
                    <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-400 outline-none resize-none"
                      placeholder="Seguimiento, intereses, próxima visita..." />
                  </div>
                  {/* Indicadores requerimientos */}
                  <div className="flex gap-2 text-xs">
                    {[{ ok: ubicacionObtenida, label: 'GPS' }, { ok: !!firmaGuardada, label: 'Firma' }, { ok: !!nombreReceptor.trim(), label: 'Receptor' }].map(({ ok, label }) => (
                      <div key={label} className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-all ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                        {ok ? <CheckCircle size={11} /> : <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300" />}
                        {label}
                      </div>
                    ))}
                  </div>
                  <button onClick={registrarVisita}
                    disabled={guardando || !ubicacionObtenida || !firmaGuardada || !nombreReceptor.trim()}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold text-sm hover:from-pink-600 hover:to-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-pink-200">
                    {guardando ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Registrando...</> : <><CheckCircle size={17} /> Registrar Visita</>}
                  </button>
                </div>
              )}
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
              <p className="text-xs text-center text-gray-400 mt-2">Usa el dedo o el mouse para firmar</p>
            </div>
            <div className="flex gap-3 px-4 pb-4">
              <button onClick={limpiarFirma} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50">🗑 Limpiar</button>
              <button onClick={confirmarFirma} disabled={firmaVacia}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl text-sm font-bold hover:from-pink-600 hover:to-rose-700 disabled:opacity-40">✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {vistaDetalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-2"><Stethoscope size={15} className="text-white" /></div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Detalle de Visita</h2>
                  <p className="text-xs text-gray-400">{formatFechaGT(vistaDetalle.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setVistaDetalle(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100">
                <p className="font-bold text-gray-900 text-base">{vistaDetalle.medico_nombre}</p>
                {vistaDetalle.medico_especialidad && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-pink-200 text-pink-800 mt-1">{vistaDetalle.medico_especialidad}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Visitadora', value: vistaDetalle.visitadora_nombre, icon: '👤' },
                  { label: 'Receptor',   value: vistaDetalle.nombre_receptor, icon: '🤝' },
                  { label: 'Fecha',      value: formatFechaGT(vistaDetalle.created_at), icon: '📅' },
                  { label: 'Hora (GT)',  value: formatHoraGT(vistaDetalle.created_at), icon: '⏰' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">{item.icon} {item.label}</p>
                    <p className="text-sm font-bold text-gray-800">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
              {vistaDetalle.comentario && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-600 font-bold mb-1 flex items-center gap-1"><MessageSquare size={11} /> Observaciones</p>
                  <p className="text-sm text-gray-700">{vistaDetalle.comentario}</p>
                </div>
              )}
              {vistaDetalle.latitud && (
                <a href={`https://maps.google.com/?q=${vistaDetalle.latitud},${vistaDetalle.longitud}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold px-4 py-3 rounded-xl hover:bg-blue-100 transition-colors">
                  <div className="bg-blue-100 rounded-lg p-1.5"><Navigation size={14} className="text-blue-600" /></div>
                  Ver en Google Maps <span className="ml-auto text-blue-400">↗</span>
                </a>
              )}
              {vistaDetalle.firma_receptor && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><PenTool size={11} /> Firma del receptor</p>
                  <div className="border-2 border-gray-100 rounded-xl overflow-hidden bg-gray-50">
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