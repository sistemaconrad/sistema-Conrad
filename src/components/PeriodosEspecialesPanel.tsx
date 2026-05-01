import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Periodo {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  creado_por?: string;
  created_at: string;
}

// Guatemala es siempre UTC-6 (no tiene horario de verano)
const GT_OFFSET_MS = 6 * 60 * 60 * 1000;

// Convierte "2026-05-01T00:00" (hora GT ingresada por el usuario) → UTC ISO string
// Sin depender de la zona horaria del browser
const gtToUTC = (localStr: string): string => {
  if (!localStr) return '';
  // localStr viene del input datetime-local: "YYYY-MM-DDTHH:MM"
  // Lo parseamos como si fuera UTC y luego sumamos 6h para convertir GT→UTC
  const [datePart, timePart] = localStr.split('T');
  const [year, month, day]   = datePart.split('-').map(Number);
  const [hour, minute]       = timePart.split(':').map(Number);
  // Crear Date en UTC con estos valores (como si GT fuera UTC)
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
  // GT = UTC-6 → para ir de GT a UTC sumamos 6h
  return new Date(asUTC + GT_OFFSET_MS).toISOString();
};

// Convierte timestamptz UTC → "YYYY-MM-DDTHH:MM" en hora GT para el input
const utcToGT = (utcStr: string): string => {
  if (!utcStr) return '';
  const utcMs = new Date(utcStr).getTime();
  const gtMs  = utcMs - GT_OFFSET_MS;
  const gt    = new Date(gtMs);
  const pad   = (n: number) => String(n).padStart(2, '0');
  return `${gt.getUTCFullYear()}-${pad(gt.getUTCMonth() + 1)}-${pad(gt.getUTCDate())}T${pad(gt.getUTCHours())}:${pad(gt.getUTCMinutes())}`;
};

// Formatea para mostrar en pantalla (hora GT)
const formatGT = (utcStr: string): string => {
  if (!utcStr) return '—';
  return new Date(utcStr).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Verifica si AHORA está dentro de algún periodo activo
const estaActivoAhora = (p: Periodo): boolean => {
  const now = new Date();
  return new Date(p.fecha_inicio) <= now && now <= new Date(p.fecha_fin);
};

const emptyForm = { nombre: '', fecha_inicio: '', fecha_fin: '' };

export const PeriodosEspecialesPanel: React.FC = () => {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando]   = useState<Periodo | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');

  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || 'Admin';

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('periodos_especiales')
      .select('*')
      .order('fecha_inicio', { ascending: false });
    setPeriodos(data || []);
    setLoading(false);
  };

  const abrirModal = (p?: Periodo) => {
    setError('');
    if (p) {
      setEditando(p);
      setForm({
        nombre:       p.nombre,
        fecha_inicio: utcToGT(p.fecha_inicio),
        fecha_fin:    utcToGT(p.fecha_fin),
      });
    } else {
      setEditando(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const guardar = async () => {
    setError('');
    if (!form.nombre.trim())    return setError('El nombre es obligatorio');
    if (!form.fecha_inicio)     return setError('La fecha de inicio es obligatoria');
    if (!form.fecha_fin)        return setError('La fecha de fin es obligatoria');
    if (form.fecha_inicio >= form.fecha_fin)
      return setError('La fecha de fin debe ser posterior al inicio');

    setGuardando(true);
    const payload = {
      nombre:       form.nombre.trim(),
      fecha_inicio: gtToUTC(form.fecha_inicio),
      fecha_fin:    gtToUTC(form.fecha_fin),
      creado_por:   nombreUsuario,
    };

    try {
      if (editando) {
        const { error } = await supabase.from('periodos_especiales').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('periodos_especiales').insert([{ ...payload, activo: true }]);
        if (error) throw error;
      }
      await cargar();
      setShowModal(false);
    } catch (e: any) {
      console.error('Error al guardar periodo:', e);
      setError(`Error al guardar: ${e?.message || 'Verifica que la tabla exista en Supabase'}`);
    }

    setGuardando(false);
  };

  const toggleActivo = async (p: Periodo) => {
    await supabase.from('periodos_especiales').update({ activo: !p.activo }).eq('id', p.id);
    setPeriodos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x));
  };

  const eliminar = async (p: Periodo) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    await supabase.from('periodos_especiales').delete().eq('id', p.id);
    setPeriodos(prev => prev.filter(x => x.id !== p.id));
  };

  const activosAhora = periodos.filter(p => p.activo && estaActivoAhora(p));

  return (
    <div className="space-y-4">

      {/* Estado actual */}
      <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-semibold
        ${activosAhora.length > 0
          ? 'bg-amber-50 border border-amber-200 text-amber-800'
          : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
        {activosAhora.length > 0
          ? <><AlertCircle size={16} className="text-amber-500 shrink-0" />
              Precio especial ACTIVO ahora: <span className="font-bold">{activosAhora.map(p => p.nombre).join(', ')}</span></>
          : <><CheckCircle size={16} className="text-emerald-500 shrink-0" />
              Horario normal activo — no hay periodos especiales en este momento</>
        }
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Calendar size={16} className="text-teal-600" />
            Periodos de Precio Especial
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Feriados, días especiales o rangos de horas con tarifa diferente. Todas las horas en zona horaria Guatemala (GT).
          </p>
        </div>
        <button onClick={() => abrirModal()}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={15} /> Agregar periodo
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="spinner" />
        </div>
      ) : periodos.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
          <Calendar size={36} className="mx-auto mb-2 opacity-30" />
          <p className="font-semibold text-slate-500">Sin periodos configurados</p>
          <p className="text-xs mt-1">Agrega feriados o rangos de precio especial</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {periodos.map(p => {
            const vigente = estaActivoAhora(p);
            const pasado  = new Date(p.fecha_fin) < new Date();
            return (
              <div key={p.id}
                className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 transition-all
                  ${vigente ? 'border-amber-300 shadow-md shadow-amber-50' : pasado ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}>

                {/* Indicador */}
                <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 mt-1.5
                  ${vigente ? 'bg-amber-400 animate-pulse' : pasado ? 'bg-slate-300' : p.activo ? 'bg-teal-400' : 'bg-slate-200'}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm">{p.nombre}</p>
                    {vigente && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">EN CURSO</span>}
                    {pasado  && <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">PASADO</span>}
                    {!vigente && !pasado && p.activo && <span className="text-xs font-bold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">PRÓXIMO</span>}
                    {!p.activo && <span className="text-xs font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">DESACTIVADO</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 flex-wrap">
                    <Clock size={11} className="text-slate-400 shrink-0" />
                    <span>Inicio: <span className="font-semibold text-slate-700">{formatGT(p.fecha_inicio)}</span></span>
                    <span className="text-slate-300">→</span>
                    <span>Fin: <span className="font-semibold text-slate-700">{formatGT(p.fecha_fin)}</span></span>
                  </div>
                  {p.creado_por && (
                    <p className="text-xs text-slate-400 mt-0.5">Creado por {p.creado_por}</p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Toggle activo/inactivo */}
                  <button onClick={() => toggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors border
                      ${p.activo
                        ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                    {p.activo ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => abrirModal(p)}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => eliminar(p)}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">

            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-slate-900">
                  {editando ? 'Editar periodo especial' : 'Nuevo periodo especial'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Todas las horas en tiempo de Guatemala (GT)</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nombre del periodo *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="input-field"
                  placeholder="Ej: 1 de Mayo — Día del Trabajo 2026"
                />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock size={11} /> Inicio (hora Guatemala) *
                </label>
                <input
                  type="datetime-local"
                  value={form.fecha_inicio}
                  onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                  className="input-field"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Desde esta fecha y hora, el sistema usará precio especial
                </p>
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock size={11} /> Fin (hora Guatemala) *
                </label>
                <input
                  type="datetime-local"
                  value={form.fecha_fin}
                  onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                  className="input-field"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Hasta esta fecha y hora, después vuelve al precio normal automáticamente
                </p>
              </div>

              {/* Preview */}
              {form.fecha_inicio && form.fecha_fin && form.fecha_inicio < form.fecha_fin && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-xs text-teal-700">
                  <p className="font-bold mb-1">📋 Resumen del periodo:</p>
                  <p>De: <span className="font-semibold">{formatGT(gtToUTC(form.fecha_inicio))}</span></p>
                  <p>A: <span className="font-semibold">{formatGT(gtToUTC(form.fecha_fin))}</span></p>
                  <p className="mt-1 text-teal-500">
                    Duración: {Math.round((new Date(gtToUTC(form.fecha_fin)).getTime() - new Date(gtToUTC(form.fecha_inicio)).getTime()) / 3600000)} horas
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors">
                {guardando
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
                  : <><Save size={15} /> {editando ? 'Guardar cambios' : 'Crear periodo'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};