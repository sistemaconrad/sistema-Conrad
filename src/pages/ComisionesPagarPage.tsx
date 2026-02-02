import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, CheckCircle, Clock, Filter, Calendar, Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ComisionesPagarPageProps {
  onBack: () => void;
}

interface ComisionPago {
  id?: string;
  medico_id: string;
  medico_nombre: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_pacientes: number;
  total_comision: number;
  estado: 'pendiente' | 'pagado';
  fecha_pago?: string;
  forma_pago?: string;
  observaciones?: string;
  detalles_comisiones: { [key: string]: number }; // Por tipo de estudio
  created_at?: string;
}

export const ComisionesPagarPage: React.FC<ComisionesPagarPageProps> = ({ onBack }) => {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [comisiones, setComisiones] = useState<ComisionPago[]>([]);
  const [comisionesSeleccionadas, setComisionesSeleccionadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'pagado'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [showModalPago, setShowModalPago] = useState(false);
  const [showModalPagoMasivo, setShowModalPagoMasivo] = useState(false);
  const [comisionSeleccionada, setComisionSeleccionada] = useState<ComisionPago | null>(null);

  const [formPago, setFormPago] = useState({
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    forma_pago: 'efectivo',
    observaciones: ''
  });

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // ✅ FUNCIÓN HELPER PARA FORMATEAR FECHAS SIN PROBLEMAS DE ZONA HORARIA
  const formatearFechaLocal = (fechaString: string) => {
    const [year, month, day] = fechaString.split('-');
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    cargarComisiones();
  }, [mes, anio]);

  const cargarComisiones = async () => {
    setLoading(true);
    try {
      // Calcular primer y último día del mes CORRECTAMENTE
      const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDiaNum = new Date(anio, mes, 0).getDate(); // Último día del mes
      const ultimoDia = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDiaNum).padStart(2, '0')}`;

      console.log('📅 Período:', { primerDia, ultimoDia });

      // Primero intentamos cargar comisiones ya registradas en la BD
      const { data: comisionesDB } = await supabase
        .from('comisiones_por_pagar')
        .select('*')
        .gte('periodo_inicio', primerDia)
        .lte('periodo_fin', ultimoDia)
        .order('medico_nombre');

      if (comisionesDB && comisionesDB.length > 0) {
        setComisiones(comisionesDB);
      } else {
        // Si no hay registros, calculamos las comisiones del período
        await calcularComisionesPeriodo(primerDia, ultimoDia);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularComisionesPeriodo = async (fechaInicio: string, fechaFin: string) => {
    try {
      const { data: consultas } = await supabase
        .from('consultas')
        .select(`
          *,
          medicos(id, nombre),
          detalle_consultas(
            precio,
            sub_estudios(
              nombre,
              estudios(
                nombre,
                porcentaje_comision
              )
            )
          )
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .not('medico_id', 'is', null)
        .eq('sin_informacion_medico', false)
        .or('anulado.is.null,anulado.eq.false')
        .or('es_servicio_movil.is.null,es_servicio_movil.eq.false');

      const medicoMap = new Map<string, ComisionPago>();

      consultas?.forEach(consulta => {
        // NO generar comisión si es social, personalizado o estado de cuenta
        if (consulta.tipo_cobro === 'social' || 
            consulta.tipo_cobro === 'personalizado' ||
            consulta.forma_pago === 'estado_cuenta' ||
            consulta.es_servicio_movil === true) {
          return;
        }

        const medicoId = consulta.medico_id;
        const medicoNombre = consulta.medicos?.nombre || 'Desconocido';

        if (!medicoMap.has(medicoId)) {
          medicoMap.set(medicoId, {
            medico_id: medicoId,
            medico_nombre: medicoNombre,
            periodo_inicio: fechaInicio,
            periodo_fin: fechaFin,
            total_pacientes: 0,
            total_comision: 0,
            estado: 'pendiente',
            detalles_comisiones: {}
          });
        }

        const medico = medicoMap.get(medicoId)!;
        medico.total_pacientes++;

        const totalConsulta = consulta.detalle_consultas?.reduce((sum, d) => sum + d.precio, 0) || 0;
        const primerDetalle = consulta.detalle_consultas?.[0];
        const estudioNombre = primerDetalle?.sub_estudios?.estudios?.nombre || 'Otros';
        const porcentaje = primerDetalle?.sub_estudios?.estudios?.porcentaje_comision || 0;
        const comisionTotal = totalConsulta * (porcentaje / 100);

        if (!medico.detalles_comisiones[estudioNombre]) {
          medico.detalles_comisiones[estudioNombre] = 0;
        }
        medico.detalles_comisiones[estudioNombre] += comisionTotal;
        medico.total_comision += comisionTotal;
      });

      const comisionesCalculadas = Array.from(medicoMap.values())
        .filter(m => m.total_comision > 0)
        .sort((a, b) => b.total_comision - a.total_comision);

      setComisiones(comisionesCalculadas);
    } catch (error) {
      console.error('Error al calcular comisiones:', error);
    }
  };

  const guardarComisiones = async () => {
    if (comisiones.length === 0) {
      alert('No hay comisiones para guardar');
      return;
    }

    try {
      const comisionesSinId = comisiones.filter(c => !c.id);
      
      if (comisionesSinId.length === 0) {
        alert('Las comisiones ya están registradas');
        return;
      }

      const { error } = await supabase
        .from('comisiones_por_pagar')
        .insert(comisionesSinId.map(c => ({
          medico_id: c.medico_id,
          medico_nombre: c.medico_nombre,
          periodo_inicio: c.periodo_inicio,
          periodo_fin: c.periodo_fin,
          total_pacientes: c.total_pacientes,
          total_comision: c.total_comision,
          estado: c.estado,
          detalles_comisiones: c.detalles_comisiones
        })));

      if (error) throw error;

      alert('Comisiones guardadas exitosamente');
      cargarComisiones();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar comisiones');
    }
  };

  const recalcularPeriodo = async () => {
    if (!confirm('¿Eliminar las comisiones guardadas de este período y recalcular? Esta acción NO se puede deshacer.')) return;

    try {
      // Calcular fechas del período
      const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDiaNum = new Date(anio, mes, 0).getDate();
      const ultimoDia = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDiaNum).padStart(2, '0')}`;

      // Eliminar comisiones del período (solo las pendientes por seguridad)
      const { error: deleteError } = await supabase
        .from('comisiones_por_pagar')
        .delete()
        .gte('periodo_inicio', primerDia)
        .lte('periodo_fin', ultimoDia)
        .eq('estado', 'pendiente');

      if (deleteError) throw deleteError;

      // Recalcular
      await calcularComisionesPeriodo(primerDia, ultimoDia);
      
      alert('Comisiones recalculadas correctamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al recalcular comisiones');
    }
  };

  const marcarComoPagado = async () => {
    if (!comisionSeleccionada) return;

    try {
      if (!comisionSeleccionada.id) {
        alert('Primero debe guardar las comisiones');
        return;
      }

      const { error } = await supabase
        .from('comisiones_por_pagar')
        .update({
          estado: 'pagado',
          fecha_pago: formPago.fecha_pago,
          forma_pago: formPago.forma_pago,
          observaciones: formPago.observaciones
        })
        .eq('id', comisionSeleccionada.id);

      if (error) throw error;

      alert('Comisión marcada como pagada');
      setShowModalPago(false);
      setComisionSeleccionada(null);
      cargarComisiones();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar comisión');
    }
  };

  const marcarComoPendiente = async (comisionId: string) => {
    if (!confirm('¿Marcar esta comisión como pendiente nuevamente?')) return;

    try {
      const { error } = await supabase
        .from('comisiones_por_pagar')
        .update({
          estado: 'pendiente',
          fecha_pago: null,
          forma_pago: null,
          observaciones: null
        })
        .eq('id', comisionId);

      if (error) throw error;
      cargarComisiones();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const toggleSeleccionComision = (comisionId: string) => {
    const newSet = new Set(comisionesSeleccionadas);
    if (newSet.has(comisionId)) {
      newSet.delete(comisionId);
    } else {
      newSet.add(comisionId);
    }
    setComisionesSeleccionadas(newSet);
  };

  const seleccionarTodas = () => {
    const pendientes = comisionesFiltradas
      .filter(c => c.estado === 'pendiente' && c.id)
      .map(c => c.id!);
    setComisionesSeleccionadas(new Set(pendientes));
  };

  const deseleccionarTodas = () => {
    setComisionesSeleccionadas(new Set());
  };

  const pagarSeleccionadas = async () => {
    if (comisionesSeleccionadas.size === 0) {
      alert('Seleccione al menos una comisión');
      return;
    }

    try {
      const updates = Array.from(comisionesSeleccionadas).map(id => 
        supabase
          .from('comisiones_por_pagar')
          .update({
            estado: 'pagado',
            fecha_pago: formPago.fecha_pago,
            forma_pago: formPago.forma_pago,
            observaciones: formPago.observaciones
          })
          .eq('id', id)
      );

      await Promise.all(updates);

      alert(`${comisionesSeleccionadas.size} comisiones marcadas como pagadas`);
      setShowModalPagoMasivo(false);
      setComisionesSeleccionadas(new Set());
      cargarComisiones();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar comisiones');
    }
  };

  const comisionesFiltradas = comisiones.filter(c => {
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado;
    const matchBusqueda = c.medico_nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchEstado && matchBusqueda;
  });

  const totalPendiente = comisionesFiltradas
    .filter(c => c.estado === 'pendiente')
    .reduce((sum, c) => sum + c.total_comision, 0);

  const totalPagado = comisionesFiltradas
    .filter(c => c.estado === 'pagado')
    .reduce((sum, c) => sum + c.total_comision, 0);

  const totalSeleccionadas = comisionesFiltradas
    .filter(c => comisionesSeleccionadas.has(c.id || ''))
    .reduce((sum, c) => sum + c.total_comision, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button onClick={onBack} className="text-white hover:text-purple-100 mb-4 flex items-center gap-2">
            <ArrowLeft size={20} />
            Volver a Contabilidad
          </button>
          <h1 className="text-4xl font-bold">💰 Comisiones por Pagar</h1>
          <p className="text-purple-100 mt-2 text-lg">Gestión de pagos a médicos referentes</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Controles */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="label">Mes</label>
              <select
                className="input-field"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {meses.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Año</label>
              <select
                className="input-field"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select
                className="input-field"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="pagado">Pagados</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Buscar médico</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Nombre del médico..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
            {comisiones.some(c => !c.id) && (
              <button
                onClick={guardarComisiones}
                className="btn-primary mt-auto"
              >
                Guardar Comisiones
              </button>
            )}
            {comisiones.some(c => c.id && c.estado === 'pendiente') && (
              <button
                onClick={recalcularPeriodo}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 mt-auto"
              >
                🔄 Recalcular Período
              </button>
            )}
            {comisionesSeleccionadas.size > 0 && (
              <button
                onClick={() => setShowModalPagoMasivo(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-auto"
              >
                Pagar Seleccionadas ({comisionesSeleccionadas.size})
              </button>
            )}
          </div>
        </div>

        {/* Controles de selección */}
        {comisionesFiltradas.filter(c => c.estado === 'pendiente' && c.id).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={seleccionarTodas}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                >
                  ✓ Seleccionar todas las pendientes
                </button>
                <button
                  onClick={deseleccionarTodas}
                  className="text-gray-600 hover:text-gray-800 font-semibold text-sm"
                >
                  ✗ Deseleccionar todas
                </button>
              </div>
              {comisionesSeleccionadas.size > 0 && (
                <div className="text-blue-900 font-bold">
                  Total seleccionado: Q {totalSeleccionadas.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <p className="text-gray-600 mb-2 text-lg">Total Pendiente</p>
              <p className="text-5xl font-bold text-orange-600">
                Q {totalPendiente.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-base text-gray-500 mt-3">
                {comisionesFiltradas.filter(c => c.estado === 'pendiente').length} comisiones
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <p className="text-gray-600 mb-2 text-lg">Total Pagado</p>
              <p className="text-5xl font-bold text-green-600">
                Q {totalPagado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-base text-gray-500 mt-3">
                {comisionesFiltradas.filter(c => c.estado === 'pagado').length} comisiones
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <p className="text-gray-600 mb-2 text-lg">Total General</p>
              <p className="text-5xl font-bold text-purple-600">
                Q {(totalPendiente + totalPagado).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-base text-gray-500 mt-3">
                {comisionesFiltradas.length} comisiones
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Comisiones */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : comisionesFiltradas.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600">No hay comisiones en este período</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comisionesFiltradas.map((comision, idx) => (
              <div key={comision.id || idx} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Checkbox de selección (solo para pendientes con ID) */}
                    {comision.estado === 'pendiente' && comision.id && (
                      <input
                        type="checkbox"
                        checked={comisionesSeleccionadas.has(comision.id)}
                        onChange={() => toggleSeleccionComision(comision.id!)}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 mt-1"
                      />
                    )}
                    {comision.estado === 'pagado' && (
                      <div className="w-5 h-5 mt-1"></div>
                    )}
                    
                    <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-bold text-xl">{comision.medico_nombre}</h3>
                      <span className={`px-4 py-1 rounded-full text-base font-semibold ${
                        comision.estado === 'pagado' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {comision.estado === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-base text-gray-600 mb-4">
                      <div>
                        <p className="font-semibold">Período</p>
                        {/* ✅ CORRECCIÓN APLICADA AQUÍ */}
                        <p>{formatearFechaLocal(comision.periodo_inicio)} - {formatearFechaLocal(comision.periodo_fin)}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Pacientes</p>
                        <p>{comision.total_pacientes}</p>
                      </div>
                      {comision.fecha_pago && (
                        <>
                          <div>
                            <p className="font-semibold">Fecha de Pago</p>
                            {/* ✅ CORRECCIÓN APLICADA AQUÍ */}
                            <p>{formatearFechaLocal(comision.fecha_pago)}</p>
                          </div>
                          <div>
                            <p className="font-semibold">Forma de Pago</p>
                            <p className="capitalize">{comision.forma_pago}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Detalles por tipo de estudio */}
                    {Object.keys(comision.detalles_comisiones).length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Desglose por estudio:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(comision.detalles_comisiones)
                            .filter(([_, monto]) => monto > 0)
                            .map(([estudio, monto]) => (
                              <div key={estudio} className="bg-purple-50 p-2 rounded text-sm">
                                <p className="text-gray-600 truncate" title={estudio}>{estudio}</p>
                                <p className="font-bold text-purple-700">Q {monto.toFixed(2)}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {comision.observaciones && (
                      <div className="mt-3 text-sm text-gray-600">
                        <p className="font-semibold">Observaciones:</p>
                        <p>{comision.observaciones}</p>
                      </div>
                    )}
                  </div>
                </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-3xl font-bold text-purple-600">
                        Q {comision.total_comision.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {comision.id && (
                      comision.estado === 'pendiente' ? (
                        <button
                          onClick={() => {
                            setComisionSeleccionada(comision);
                            setShowModalPago(true);
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                        >
                          <CheckCircle size={20} />
                          Marcar como Pagado
                        </button>
                      ) : (
                        <button
                          onClick={() => marcarComoPendiente(comision.id!)}
                          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 flex items-center gap-2"
                        >
                          <Clock size={20} />
                          Marcar Pendiente
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Marcar como Pagado */}
      {showModalPago && comisionSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Registrar Pago</h2>
            
            <div className="mb-4">
              <p className="text-gray-600">Médico:</p>
              <p className="font-bold text-lg">{comisionSeleccionada.medico_nombre}</p>
            </div>

            <div className="mb-4">
              <p className="text-gray-600">Monto:</p>
              <p className="font-bold text-2xl text-purple-600">
                Q {comisionSeleccionada.total_comision.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Fecha de Pago *</label>
                <input
                  type="date"
                  className="input-field"
                  value={formPago.fecha_pago}
                  onChange={(e) => setFormPago({...formPago, fecha_pago: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="label">Forma de Pago *</label>
                <select
                  className="input-field"
                  value={formPago.forma_pago}
                  onChange={(e) => setFormPago({...formPago, forma_pago: e.target.value})}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="label">Observaciones</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={formPago.observaciones}
                  onChange={(e) => setFormPago({...formPago, observaciones: e.target.value})}
                  placeholder="Notas adicionales (opcional)"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowModalPago(false);
                  setComisionSeleccionada(null);
                  setFormPago({
                    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
                    forma_pago: 'efectivo',
                    observaciones: ''
                  });
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={marcarComoPagado}
                className="btn-primary"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Masivo */}
      {showModalPagoMasivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Pagar Comisiones Seleccionadas</h2>
            
            <div className="mb-4">
              <p className="text-gray-600">Comisiones a pagar:</p>
              <p className="font-bold text-lg">{comisionesSeleccionadas.size} comisiones</p>
            </div>

            <div className="mb-4">
              <p className="text-gray-600">Monto total:</p>
              <p className="font-bold text-2xl text-purple-600">
                Q {totalSeleccionadas.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="mb-4 max-h-40 overflow-y-auto bg-gray-50 rounded p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Médicos seleccionados:</p>
              {comisionesFiltradas
                .filter(c => comisionesSeleccionadas.has(c.id || ''))
                .map(c => (
                  <div key={c.id} className="text-sm text-gray-600 py-1 border-b last:border-0">
                    {c.medico_nombre} - Q {c.total_comision.toFixed(2)}
                  </div>
                ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Fecha de Pago *</label>
                <input
                  type="date"
                  className="input-field"
                  value={formPago.fecha_pago}
                  onChange={(e) => setFormPago({...formPago, fecha_pago: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="label">Forma de Pago *</label>
                <select
                  className="input-field"
                  value={formPago.forma_pago}
                  onChange={(e) => setFormPago({...formPago, forma_pago: e.target.value})}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="label">Observaciones</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={formPago.observaciones}
                  onChange={(e) => setFormPago({...formPago, observaciones: e.target.value})}
                  placeholder="Notas adicionales (opcional)"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowModalPagoMasivo(false);
                  setFormPago({
                    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
                    forma_pago: 'efectivo',
                    observaciones: ''
                  });
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={pagarSeleccionadas}
                className="btn-primary"
              >
                Confirmar Pagos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};