import React, { useState, useEffect } from 'react';
import { CheckCircle, DollarSign, Search, ChevronDown, ChevronRight, CreditCard, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';


interface MedicoComision {
  medico_id: string;
  medico_nombre: string;
  total_consultas: number;
  total_comision: number;
  comisiones_por_estudio: { [key: string]: number };
  tipos_cobro?: { [key: string]: number };
  seleccionado: boolean;
  ya_pagado: boolean;
  pago_id?: string;
}

interface PagoHistorial {
  id: string;
  mes: number;
  anio: number;
  medico_id: string;
  medico_nombre: string;
  monto: number;
  fecha_pago: string;
  pagado_por: string;
}

const meses = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const fmt = (n: number) => `Q ${n.toFixed(2)}`;

export const PagosComisionesView: React.FC = () => {
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [medicos, setMedicos] = useState<MedicoComision[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [historial, setHistorial] = useState<PagoHistorial[]>([]);
  const [tabActiva, setTabActiva] = useState<'pagar' | 'historial'>('pagar');
  const [expandidoHistorial, setExpandidoHistorial] = useState<string | null>(null);

  useEffect(() => { cargarDatos(); }, [mes, anio]);

  const cargarDatos = async () => {
    setLoading(true);
    await Promise.all([cargarComisiones(), cargarHistorial()]);
    setLoading(false);
  };

  const cargarComisiones = async () => {
    const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${lastDay}`;

    const [{ data: consultas }, { data: pagosExistentes }] = await Promise.all([
      supabase.from('consultas').select(`
        id, fecha, tipo_cobro, medico_id, forma_pago, es_servicio_movil, sin_informacion_medico, sin_orden_medica,
        medicos(id, nombre, es_referente),
        detalle_consultas(precio, sub_estudios(nombre, estudios(nombre, porcentaje_comision)))
      `)
      .not('medico_id', 'is', null)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .or('anulado.is.null,anulado.eq.false'),

      supabase.from('pagos_comisiones')
        .select('*')
        .eq('mes', mes)
        .eq('anio', anio)
    ]);

    const pagosPorMedico: { [k: string]: string } = {};
    (pagosExistentes || []).forEach((p: any) => {
      pagosPorMedico[p.medico_id] = p.id;
    });

    const medicoMap = new Map<string, MedicoComision>();

    (consultas || []).forEach((c: any) => {
      // ✅ Solo referentes, sin social/personalizado/servicio_movil
      // ✅ estado_cuenta SÍ genera comisión
      if (
        c.tipo_cobro === 'social' ||
        c.tipo_cobro === 'personalizado' ||
        c.es_servicio_movil === true ||
        c.sin_informacion_medico === true ||
        !c.medico_id || !c.medicos
      ) return;
      if (!c.medicos.es_referente) return;

      const medicoId = c.medico_id;
      if (!medicoMap.has(medicoId)) {
        medicoMap.set(medicoId, {
          medico_id: medicoId,
          medico_nombre: c.medicos.nombre,
          total_consultas: 0,
          total_comision: 0,
          comisiones_por_estudio: {},
          seleccionado: false,
          ya_pagado: !!pagosPorMedico[medicoId],
          pago_id: pagosPorMedico[medicoId],
        });
      }

      const medico = medicoMap.get(medicoId)!;
      medico.total_consultas++;

      // ✅ Cálculo línea por línea (igual que ComisionesView)
      let comisionConsulta = 0;
      (c.detalle_consultas || []).forEach((d: any) => {
        const precio = d.precio || 0;
        const estudio = d.sub_estudios?.estudios?.nombre || 'Otros';
        const pct = d.sub_estudios?.estudios?.porcentaje_comision || 0;
        const comisionLinea = precio * (pct / 100);
        comisionConsulta += comisionLinea;
        if (!medico.comisiones_por_estudio[estudio]) medico.comisiones_por_estudio[estudio] = 0;
        medico.comisiones_por_estudio[estudio] += comisionLinea;
      });

      // Etiqueta tipo: estado_cuenta viene en forma_pago
      const etiqueta = c.forma_pago === 'estado_cuenta' ? 'estado_cuenta' : c.tipo_cobro;
      if (!medico.tipos_cobro) medico.tipos_cobro = {};
      if (!medico.tipos_cobro[etiqueta]) medico.tipos_cobro[etiqueta] = 0;
      medico.tipos_cobro[etiqueta]++;

      medico.total_comision += comisionConsulta;
    });

    setMedicos(Array.from(medicoMap.values()).sort((a, b) => b.total_comision - a.total_comision));
  };

  const cargarHistorial = async () => {
    const { data } = await supabase
      .from('pagos_comisiones')
      .select('*')
      .order('fecha_pago', { ascending: false })
      .limit(100);
    setHistorial(data || []);
  };

  const toggleSeleccion = (medicoId: string) => {
    setMedicos(prev => prev.map(m =>
      m.medico_id === medicoId && !m.ya_pagado ? { ...m, seleccionado: !m.seleccionado } : m
    ));
  };

  const seleccionarTodos = () => {
    const pendientes = medicos.filter(m => !m.ya_pagado);
    const todosMarcados = pendientes.every(m => m.seleccionado);
    setMedicos(prev => prev.map(m =>
      m.ya_pagado ? m : { ...m, seleccionado: !todosMarcados }
    ));
  };

  const registrarPagos = async () => {
    const seleccionados = medicos.filter(m => m.seleccionado && !m.ya_pagado);
    if (seleccionados.length === 0) {
      alert('Selecciona al menos un médico para registrar el pago');
      return;
    }
    if (!confirm(`¿Confirmar pago de comisiones a ${seleccionados.length} médico(s)?`)) return;

    setGuardando(true);
    try {
      const pagador = localStorage.getItem('nombreUsuarioConrad') || 'Sistema';
      const inserts = seleccionados.map(m => ({
        mes,
        anio,
        medico_id: m.medico_id,
        medico_nombre: m.medico_nombre,
        monto: parseFloat(m.total_comision.toFixed(2)),
        fecha_pago: new Date().toISOString(),
        pagado_por: pagador,
      }));

      const { error } = await supabase.from('pagos_comisiones').insert(inserts);
      if (error) throw error;

      alert(`✅ Pagos registrados exitosamente para ${seleccionados.length} médico(s)`);
      await cargarDatos();
    } catch (e) {
      alert('Error al registrar pagos. Verifica que exista la tabla pagos_comisiones.');
    }
    setGuardando(false);
  };

  const filtrados = medicos.filter(m =>
    m.medico_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const pendientes = medicos.filter(m => !m.ya_pagado);
  const pagados = medicos.filter(m => m.ya_pagado);
  const seleccionados = medicos.filter(m => m.seleccionado);
  const totalSeleccionado = seleccionados.reduce((s, m) => s + m.total_comision, 0);
  const totalPendiente = pendientes.reduce((s, m) => s + m.total_comision, 0);

  return (
    <div>
      {/* Selector período */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent">
          {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent">
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-sm text-gray-500 font-medium">{meses[mes - 1]} {anio}</span>
      </div>

      {/* Tabs internas */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTabActiva('pagar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tabActiva === 'pagar' ? 'bg-pink-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          <CreditCard size={15} /> Registrar Pagos
        </button>
        <button onClick={() => setTabActiva('historial')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tabActiva === 'historial' ? 'bg-pink-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          <Clock size={15} /> Historial de Pagos
        </button>
      </div>

      {tabActiva === 'pagar' ? (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Pendientes de pago</p>
              <p className="text-2xl font-bold text-orange-500">{pendientes.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Total pendiente</p>
              <p className="text-lg font-bold text-orange-500">{fmt(totalPendiente)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">Ya pagados</p>
              <p className="text-2xl font-bold text-green-600">{pagados.length}</p>
            </div>
            <div className={`rounded-xl p-4 shadow-sm border ${seleccionados.length > 0 ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-100'}`}>
              <p className="text-xs text-gray-500">Seleccionados a pagar</p>
              <p className={`text-lg font-bold ${seleccionados.length > 0 ? 'text-pink-600' : 'text-gray-400'}`}>
                {fmt(totalSeleccionado)}
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
            <div className="flex gap-2 items-center flex-1">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input type="text" placeholder="Buscar médico..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent" />
              {pendientes.length > 0 && (
                <button onClick={seleccionarTodos}
                  className="text-xs text-pink-600 hover:underline whitespace-nowrap">
                  {pendientes.every(m => m.seleccionado) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>
            {seleccionados.length > 0 && (
              <button onClick={registrarPagos} disabled={guardando}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
                <CheckCircle size={16} />
                {guardando ? 'Registrando...' : `Pagar ${seleccionados.length} médico(s) — ${fmt(totalSeleccionado)}`}
              </button>
            )}
          </div>

          {/* Lista de médicos */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-100">
              <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Sin comisiones para este período</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {filtrados.map(m => (
                  <div key={m.medico_id} className={`${m.ya_pagado ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSeleccion(m.medico_id)}
                        disabled={m.ya_pagado}
                        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          m.ya_pagado ? 'border-green-400 bg-green-400 cursor-default' :
                          m.seleccionado ? 'border-pink-600 bg-pink-600' : 'border-gray-300 hover:border-pink-400'
                        }`}
                      >
                        {(m.seleccionado || m.ya_pagado) && <CheckCircle size={12} className="text-white" />}
                      </button>

                      {/* Info médico */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm">Dr. {m.medico_nombre}</p>
                          {m.ya_pagado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle size={10} /> Pagado
                            </span>
                          )}
                          {!m.ya_pagado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <AlertCircle size={10} /> Pendiente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">{m.total_consultas} consultas</span>
                          {m.tipos_cobro?.['normal'] ? (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                              Normal: {m.tipos_cobro['normal']}
                            </span>
                          ) : null}
                          {m.tipos_cobro?.['especial'] ? (
                            <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">
                              Especial: {m.tipos_cobro['especial']}
                            </span>
                          ) : null}
                          {m.tipos_cobro?.['estado_cuenta'] ? (
                            <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                              Est.Cuenta: {m.tipos_cobro['estado_cuenta']}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Monto + expand */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-bold text-sm ${m.ya_pagado ? 'text-green-600' : 'text-gray-900'}`}>
                            {fmt(m.total_comision)}
                          </p>
                          {Object.entries(m.comisiones_por_estudio).map(([est, monto]) =>
                            monto > 0 ? <p key={est} className="text-xs text-gray-400">{est}: {fmt(monto)}</p> : null
                          )}
                        </div>
                        <button onClick={() => setExpandido(expandido === m.medico_id ? null : m.medico_id)}
                          className="p-1 text-gray-400 hover:text-gray-600">
                          {expandido === m.medico_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                    </div>

                    {expandido === m.medico_id && (
                      <div className="bg-gray-50 px-5 pb-3 text-xs text-gray-600">
                        <div className="grid grid-cols-2 gap-3 py-3 border-t border-gray-100">
                          {Object.entries(m.comisiones_por_estudio).map(([est, monto]) => (
                            <div key={est} className="flex justify-between">
                              <span>{est}</span>
                              <span className="font-medium">{fmt(monto)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* === HISTORIAL === */
        <div>
          {historial.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-100">
              <Clock size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Sin pagos registrados aún</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Agrupar por mes/año */}
              {Array.from(new Set(historial.map(p => `${p.anio}-${p.mes}`))).map(key => {
                const [a, m] = key.split('-').map(Number);
                const pagosDelMes = historial.filter(p => p.anio === a && p.mes === m);
                const totalMes = pagosDelMes.reduce((s, p) => s + p.monto, 0);
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpandidoHistorial(expandidoHistorial === key ? null : key)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 rounded-full p-2">
                          <CheckCircle size={15} className="text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900 text-sm">{meses[m - 1]} {a}</p>
                          <p className="text-xs text-gray-500">{pagosDelMes.length} médicos pagados</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-green-600 text-sm">{fmt(totalMes)}</p>
                        {expandidoHistorial === key ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandidoHistorial === key && (
                      <div className="divide-y divide-gray-50">
                        {pagosDelMes.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Dr. {p.medico_nombre}</p>
                              <p className="text-xs text-gray-400">
                                Pagado por {p.pagado_por} · {new Date(p.fecha_pago).toLocaleDateString('es-GT')}
                              </p>
                            </div>
                            <p className="font-bold text-green-600 text-sm">{fmt(p.monto)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};