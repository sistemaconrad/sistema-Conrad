import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Plus, X, Search, CheckCircle, Clock, Calendar,
  PenTool, Navigation, Stethoscope, MessageSquare, Eye, Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';



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

const CANVAS_W = 340;
const CANVAS_H = 140;

export const VisitasView: React.FC = () => {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [medicoSeleccionado, setMedicoSeleccionado] = useState<Medico | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Form de visita
  const [ubicacionObtenida, setUbicacionObtenida] = useState(false);
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Firma canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dibujando, setDibujando] = useState(false);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Filtros visitas
  const [filtroFecha, setFiltroFecha] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<Visita | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

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

  // --- Firma (canvas) ---
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDibujando(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!dibujando || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setFirmaVacia(false);
  };

  const endDraw = () => setDibujando(false);

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setFirmaVacia(true);
  };

  const obtenerUbicacion = () => {
    if (!navigator.geolocation) {
      alert('Tu dispositivo no soporta geolocalización');
      return;
    }
    setObteniendoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitud(pos.coords.latitude);
        setLongitud(pos.coords.longitude);
        setUbicacionObtenida(true);
        setObteniendoUbicacion(false);
      },
      () => {
        alert('No se pudo obtener la ubicación. Verifica los permisos.');
        setObteniendoUbicacion(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const registrarVisita = async () => {
    if (!medicoSeleccionado) return;
    if (!ubicacionObtenida) {
      alert('Debes obtener la ubicación GPS antes de registrar la visita');
      return;
    }
    if (firmaVacia) {
      alert('Por favor obtén la firma del receptor');
      return;
    }
    if (!nombreReceptor.trim()) {
      alert('Indica el nombre de quien recibió la visita');
      return;
    }

    setGuardando(true);
    try {
      const firmaDataUrl = canvasRef.current!.toDataURL('image/png');
      const visitadora = localStorage.getItem('nombreUsuarioConrad') || 'Visitadora';

      await supabase.from('visitas_medicas').insert([{
        medico_id: medicoSeleccionado.id,
        medico_nombre: medicoSeleccionado.nombre,
        medico_especialidad: medicoSeleccionado.especialidad || null,
        visitadora_nombre: visitadora,
        latitud,
        longitud,
        firma_receptor: firmaDataUrl,
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
    setShowModal(false);
    setStep(1);
    setMedicoSeleccionado(null);
    setBusqueda('');
    setUbicacionObtenida(false);
    setLatitud(null);
    setLongitud(null);
    setNombreReceptor('');
    setComentario('');
    setFirmaVacia(true);
    limpiarFirma();
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
      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Visitas hoy</p>
          <p className="text-2xl font-bold text-pink-600">{visitasHoy}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Total visitas</p>
          <p className="text-2xl font-bold text-gray-800">{visitas.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500">Médicos visitados</p>
          <p className="text-2xl font-bold text-gray-800">
            {new Set(visitas.map(v => v.medico_id)).size}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-gray-400" />
          <input
            type="date"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
          {filtroFecha && (
            <button onClick={() => setFiltroFecha('')} className="text-xs text-gray-400 hover:text-gray-600">
              Limpiar
            </button>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Nueva Visita
        </button>
      </div>

      {/* Lista de visitas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
          </div>
        ) : visitasFiltradas.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <MapPin size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No hay visitas registradas</p>
            <p className="text-sm">Registra la primera visita médica</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visitasFiltradas.map(v => {
              const fecha = new Date(v.created_at);
              return (
                <div key={v.id} className="flex items-center justify-between px-5 py-4 hover:bg-pink-50/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-pink-100 rounded-full p-2 shrink-0">
                      <Stethoscope size={16} className="text-pink-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">Dr. {v.medico_nombre}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {v.medico_especialidad && <span className="mr-2">{v.medico_especialidad}</span>}
                        Recibió: {v.nombre_receptor}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-gray-700">
                        {fecha.toLocaleDateString('es-GT')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {fecha.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {v.latitud && (
                      <a
                        href={`https://maps.google.com/?q=${v.latitud},${v.longitud}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                        title="Ver en mapa"
                      >
                        <Navigation size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => setVistaDetalle(v)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                      title="Ver detalle"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======= MODAL NUEVA VISITA ======= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Registrar Visita</h2>
                <p className="text-xs text-gray-500">
                  {step === 1 ? 'Paso 1: Selecciona el médico' : `Paso 2: Detalles de la visita - Dr. ${medicoSeleccionado?.nombre}`}
                </p>
              </div>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* PASO 1: Seleccionar médico */}
              {step === 1 && (
                <div>
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar médico..."
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {medicosFiltrados.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMedicoSeleccionado(m); setStep(2); }}
                        className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-pink-400 hover:bg-pink-50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-gray-100 group-hover:bg-pink-100 rounded-full p-2 transition-colors">
                            <Stethoscope size={16} className="text-gray-500 group-hover:text-pink-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">Dr. {m.nombre}</p>
                            <p className="text-xs text-gray-500">
                              {m.especialidad && <span className="mr-2">{m.especialidad} •</span>}
                              {m.municipio}, {m.departamento}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {medicosFiltrados.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Stethoscope size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No se encontraron médicos</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PASO 2: Detalles */}
              {step === 2 && medicoSeleccionado && (
                <div className="space-y-5">
                  {/* Info médico */}
                  <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                    <p className="text-xs font-semibold text-pink-600 mb-1">Médico seleccionado</p>
                    <p className="font-bold text-gray-900">Dr. {medicoSeleccionado.nombre}</p>
                    {medicoSeleccionado.clinica && <p className="text-sm text-gray-600">{medicoSeleccionado.clinica}</p>}
                    <p className="text-xs text-gray-500">{medicoSeleccionado.direccion}</p>
                    <button
                      onClick={() => { setStep(1); setUbicacionObtenida(false); limpiarFirma(); }}
                      className="text-xs text-pink-600 hover:underline mt-1"
                    >
                      Cambiar médico
                    </button>
                  </div>

                  {/* Ubicación GPS */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Navigation size={13} /> Ubicación GPS *
                    </p>
                    {ubicacionObtenida ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle size={16} className="text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-700">Ubicación obtenida</p>
                          <p className="text-xs text-green-600">{latitud?.toFixed(5)}, {longitud?.toFixed(5)}</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={obtenerUbicacion}
                        disabled={obteniendoUbicacion}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50 transition-all disabled:opacity-60"
                      >
                        {obteniendoUbicacion ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600" />
                        ) : (
                          <MapPin size={16} />
                        )}
                        {obteniendoUbicacion ? 'Obteniendo ubicación...' : 'Obtener mi ubicación actual'}
                      </button>
                    )}
                  </div>

                  {/* Nombre receptor */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Nombre de quien recibió *
                    </label>
                    <input
                      type="text"
                      value={nombreReceptor}
                      onChange={e => setNombreReceptor(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="Nombre de la persona que atendió"
                    />
                  </div>

                  {/* Firma */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <PenTool size={13} /> Firma del receptor *
                      </p>
                      <button onClick={limpiarFirma} className="text-xs text-gray-400 hover:text-gray-600">
                        Limpiar
                      </button>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                      <canvas
                        ref={canvasRef}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        className="w-full touch-none cursor-crosshair"
                        style={{ height: CANVAS_H }}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                      />
                    </div>
                    {firmaVacia && (
                      <p className="text-xs text-gray-400 mt-1 text-center">Solicita la firma del receptor aquí</p>
                    )}
                  </div>

                  {/* Comentario */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <MessageSquare size={13} /> Comentarios / Observaciones
                    </label>
                    <textarea
                      value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                      placeholder="Ej: Interesado en estudios de laboratorio, requiere seguimiento..."
                    />
                  </div>

                  <button
                    onClick={registrarVisita}
                    disabled={guardando || !ubicacionObtenida || firmaVacia || !nombreReceptor.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {guardando ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    {guardando ? 'Registrando...' : 'Registrar Visita'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle visita */}
      {vistaDetalle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-bold text-gray-800">Detalle de Visita</h2>
              <button onClick={() => setVistaDetalle(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Médico visitado</p>
                <p className="font-semibold text-gray-900">Dr. {vistaDetalle.medico_nombre}</p>
                {vistaDetalle.medico_especialidad && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mt-1">
                    {vistaDetalle.medico_especialidad}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Visitadora</p>
                  <p className="text-sm font-medium text-gray-800">{vistaDetalle.visitadora_nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Receptor</p>
                  <p className="text-sm font-medium text-gray-800">{vistaDetalle.nombre_receptor}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fecha</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(vistaDetalle.created_at).toLocaleDateString('es-GT')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hora</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(vistaDetalle.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              {vistaDetalle.comentario && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Comentario</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{vistaDetalle.comentario}</p>
                </div>
              )}
              {vistaDetalle.latitud && (
                <a
                  href={`https://maps.google.com/?q=${vistaDetalle.latitud},${vistaDetalle.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
                >
                  <Navigation size={15} />
                  Ver ubicación en Google Maps
                </a>
              )}
              {vistaDetalle.firma_receptor && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Firma del receptor</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
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