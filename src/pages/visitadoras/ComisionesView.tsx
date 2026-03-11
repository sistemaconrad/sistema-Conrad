import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MedicoComision {
  medico_id: string;
  medico_nombre: string;
  total_consultas: number;
  comisiones_por_estudio: { [key: string]: number };
  total_comision: number;
  detalle: ConsultaComision[];
}

interface ConsultaComision {
  id: string;
  fecha: string;
  paciente_nombre: string;
  total: number;
  comision: number;
  porcentaje: number;
  tipo_cobro: string;
  estudio: string;
}

export const ComisionesView: React.FC = () => {
  const [data, setData] = useState<MedicoComision[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [anio, setAnio] = useState(() => new Date().getFullYear());

  useEffect(() => { cargarComisiones(); }, [mes, anio]);

  const cargarComisiones = async () => {
    setLoading(true);
    try {
      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const lastDay = new Date(anio, mes, 0).getDate();
      const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${lastDay}`;

      const { data: consultas } = await supabase
        .from('consultas')
        .select(`
          id, fecha, tipo_cobro, medico_id, forma_pago, es_servicio_movil, sin_informacion_medico,
          pacientes(nombre),
          medicos(id, nombre, es_referente),
          detalle_consultas(
            precio,
            sub_estudios(
              nombre,
              estudios(
                id,
                nombre,
                porcentaje_comision
              )
            )
          )
        `)
        .not('medico_id', 'is', null)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .or('anulado.is.null,anulado.eq.false')
        .order('fecha', { ascending: false });

      if (!consultas) { setLoading(false); return; }

      const medicoMap = new Map<string, MedicoComision>();

      consultas.forEach((c: any) => {
        // Mismas exclusiones que ComisionesPage
        if (
          c.tipo_cobro === 'social' ||
          c.tipo_cobro === 'personalizado' ||
          c.es_servicio_movil === true ||
          c.sin_informacion_medico === true
        ) return;

        // ✅ Solo médicos REFERENTES generan comisión
        // ✅ estado_cuenta SÍ genera comisión
        if (!c.medico_id || !c.medicos) return;
        if (!c.medicos.es_referente) return;

        const medicoId = c.medico_id;
        const medicoNombre = c.medicos.nombre;

        if (!medicoMap.has(medicoId)) {
          medicoMap.set(medicoId, {
            medico_id: medicoId,
            medico_nombre: medicoNombre,
            total_consultas: 0,
            comisiones_por_estudio: {},
            total_comision: 0,
            detalle: [],
          });
        }

        const medico = medicoMap.get(medicoId)!;
        medico.total_consultas++;

        // Calcular comisión línea por línea (porcentaje variable por estudio)
        let totalConsulta = 0;
        let comisionTotal = 0;
        const estudiosUsados: string[] = [];

        (c.detalle_consultas || []).forEach((d: any) => {
          const precio = d.precio || 0;
          const estudio = d.sub_estudios?.estudios?.nombre || 'Otros';
          const pct = d.sub_estudios?.estudios?.porcentaje_comision || 0;
          const comisionLinea = precio * (pct / 100);
          totalConsulta += precio;
          comisionTotal += comisionLinea;
          estudiosUsados.push(estudio);
          if (!medico.comisiones_por_estudio[estudio]) medico.comisiones_por_estudio[estudio] = 0;
          medico.comisiones_por_estudio[estudio] += comisionLinea;
        });

        medico.total_comision += comisionTotal;

        const estudioNombre = estudiosUsados[0] || 'Otros';
        const porcentaje = c.detalle_consultas?.[0]?.sub_estudios?.estudios?.porcentaje_comision || 0;

        // Determinar etiqueta real: estado_cuenta va en forma_pago
        const etiquetaTipo = c.forma_pago === 'estado_cuenta'
          ? 'estado_cuenta'
          : c.tipo_cobro;

        medico.detalle.push({
          id: c.id,
          fecha: c.fecha,
          paciente_nombre: c.pacientes?.nombre || 'Paciente',
          total: totalConsulta,
          comision: comisionTotal,
          porcentaje,
          tipo_cobro: etiquetaTipo,
          estudio: estudiosUsados.length > 1 ? estudiosUsados.join(' / ') : estudioNombre,
        });
      });

      setData(Array.from(medicoMap.values()).sort((a, b) => b.total_comision - a.total_comision));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const totalGeneral = data.reduce((s, d) => s + d.total_comision, 0);
  const totalConsultas = data.reduce((s, d) => s + d.total_consultas, 0);

  const filtrado = data.filter(d =>
    d.medico_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const meses = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  const fmt = (n: number) => `Q ${n.toFixed(2)}`;

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent">
          {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent">
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar médico..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent" />
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-4 text-white shadow-sm">
          <p className="text-xs text-pink-100">Total comisiones</p>
          <p className="text-xl font-bold">{fmt(totalGeneral)}</p>
          <p className="text-xs text-pink-100 mt-1">{meses[mes - 1]} {anio}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Consultas referidas</p>
          <p className="text-2xl font-bold text-gray-800">{totalConsultas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500">Médicos con comisión</p>
          <p className="text-2xl font-bold text-gray-800">{data.length}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500">Comisión calculada según porcentaje variable por tipo de estudio (configurado en cada estudio)</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
          </div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Sin comisiones para este período</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtrado.map(item => (
              <div key={item.medico_id}>
                <button
                  onClick={() => setExpandido(expandido === item.medico_id ? null : item.medico_id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-pink-50/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-pink-100 rounded-full p-2">
                      <TrendingUp size={15} className="text-pink-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Dr. {item.medico_nombre}</p>
                      <p className="text-xs text-gray-500">{item.total_consultas} consultas referidas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">{fmt(item.total_comision)}</p>
                      {/* Desglose por tipo de cobro */}
                      <div className="flex gap-1 justify-end flex-wrap mt-0.5">
                        {item.detalle.filter(d => d.tipo_cobro === 'normal').length > 0 && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                            Normal: {item.detalle.filter(d => d.tipo_cobro === 'normal').length}
                          </span>
                        )}
                        {item.detalle.filter(d => d.tipo_cobro === 'especial').length > 0 && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">
                            Especial: {item.detalle.filter(d => d.tipo_cobro === 'especial').length}
                          </span>
                        )}
                        {item.detalle.filter(d => d.tipo_cobro === 'estado_cuenta').length > 0 && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                            Est.Cuenta: {item.detalle.filter(d => d.tipo_cobro === 'estado_cuenta').length}
                          </span>
                        )}
                      </div>
                    </div>
                    {expandido === item.medico_id
                      ? <ChevronDown size={16} className="text-gray-400" />
                      : <ChevronRight size={16} className="text-gray-400" />
                    }
                  </div>
                </button>

                {expandido === item.medico_id && (
                  <div className="bg-gray-50 px-5 pb-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left py-2 pr-4 font-semibold">Fecha</th>
                            <th className="text-left py-2 pr-4 font-semibold">Paciente</th>
                            <th className="text-left py-2 pr-4 font-semibold">Estudio</th>
                            <th className="text-left py-2 pr-4 font-semibold">Tipo</th>
                            <th className="text-right py-2 pr-4 font-semibold">Total</th>
                            <th className="text-right py-2 pr-4 font-semibold">%</th>
                            <th className="text-right py-2 font-semibold text-pink-600">Comisión</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {item.detalle.map(d => (
                            <tr key={d.id} className="hover:bg-white">
                              <td className="py-2 pr-4 text-gray-600">
                                {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-GT')}
                              </td>
                              <td className="py-2 pr-4 text-gray-900 font-medium">{d.paciente_nombre}</td>
                              <td className="py-2 pr-4 text-gray-600">{d.estudio}</td>
                              <td className="py-2 pr-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  d.tipo_cobro === 'normal'        ? 'bg-blue-100 text-blue-700' :
                                  d.tipo_cobro === 'especial'      ? 'bg-purple-100 text-purple-700' :
                                  d.tipo_cobro === 'estado_cuenta' ? 'bg-amber-100 text-amber-700' :
                                  d.tipo_cobro === 'social'        ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {d.tipo_cobro === 'estado_cuenta' ? 'Est. Cuenta' :
                                   d.tipo_cobro === 'especial'      ? 'Especial' :
                                   d.tipo_cobro === 'normal'        ? 'Normal' :
                                   d.tipo_cobro}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-700">{fmt(d.total)}</td>
                              <td className="py-2 pr-4 text-right text-gray-500">{d.porcentaje}%</td>
                              <td className="py-2 text-right font-bold text-pink-600">{fmt(d.comision)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};