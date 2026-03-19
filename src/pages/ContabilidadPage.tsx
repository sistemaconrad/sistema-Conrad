import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  Users,
  Download,
  Clock,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { GastosPage } from './GastosPage';
import { IngresosPage } from './IngresosPage';
import { ProveedoresContabilidadPage } from './ProveedoresContabilidadPage';
import { ReportesFinancierosPage } from './ReportesFinancierosPage';
import { ComisionesPagarPage } from './ComisionesPagarPage';
import { EstadisticasPage } from './EstadisticasPage';

interface ContabilidadPageProps {
  onBack: () => void;
}

type Vista = 'dashboard' | 'ingresos' | 'gastos' | 'proveedores' | 'reportes' | 'comisiones' | 'estadisticas';

// ✅ INTERFAZ NUEVA para el componente de resumen
interface CuadrePorFormaPago {
  forma_pago: string;
  cantidad: number;
  total: number;
}

export const ContabilidadPage: React.FC<ContabilidadPageProps> = ({ onBack }) => {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  
  const [totales, setTotales] = useState({
    ingresos: 0,
    gastos: 0,
    gastosOperativos: 0,
    comisionesPagadas: 0,
    utilidad: 0,
    ingresosSinGastosOperativos: 0,
    ingresosConsultas: 0,
    ingresosMoviles: 0,
    ingresosAdicionales: 0,
    comisionesPendientes: 0
  });

  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [desgloseExpandido, setDesgloseExpandido] = useState(false);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [mes, anio]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`;

      console.log('📅 Cargando datos:', { primerDia, ultimoDia });

      // ✅ 1. Ingresos por consultas REGULARES (sin móviles)
      const { data: consultasRegulares } = await supabase
        .from('consultas')
        .select(`
          fecha,
          detalle_consultas(precio)
        `)
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia)
        .or('anulado.is.null,anulado.eq.false')
        .or('es_servicio_movil.is.null,es_servicio_movil.eq.false');

      console.log('💰 Consultas regulares:', consultasRegulares?.length);

      const ingresosConsultas = consultasRegulares?.reduce((sum, c: any) => {
        return sum + (c.detalle_consultas?.reduce((s: number, d: any) => s + d.precio, 0) || 0);
      }, 0) || 0;

      // ✅ 2. Ingresos por SERVICIOS MÓVILES (separado)
      const { data: consultasMoviles } = await supabase
        .from('consultas')
        .select(`
          *,
          detalle_consultas(precio)
        `)
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia)
        .or('anulado.is.null,anulado.eq.false')
        .eq('es_servicio_movil', true);

      console.log('📱 Consultas móviles:', consultasMoviles?.length);

      const ingresosMoviles = consultasMoviles?.reduce((sum, c: any) => {
        const totalRX = c.detalle_consultas?.reduce((s: number, d: any) => s + d.precio, 0) || 0;
        let totalExtras = 0;
        if (c.movil_incluye_placas) totalExtras += c.movil_precio_placas || 0;
        if (c.movil_incluye_informe) totalExtras += c.movil_precio_informe || 0;
        return sum + totalRX + totalExtras;
      }, 0) || 0;

      // 3. Ingresos adicionales
      const { data: ingresosAd } = await supabase
        .from('ingresos_adicionales')
        .select('monto')
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia);

      const ingresosAdicionales = ingresosAd?.reduce((sum, i) => sum + i.monto, 0) || 0;

      // 4. Gastos (incluyendo comisiones pagadas)
      const { data: gastosData } = await supabase
        .from('gastos')
        .select('monto, fecha')
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia);

      console.log('📉 Gastos encontrados:', gastosData?.length);

      const gastosOperativos = gastosData?.reduce((sum, g) => sum + g.monto, 0) || 0;

      // Comisiones PAGADAS en este período
      const { data: comisionesPagadasData } = await supabase
        .from('comisiones_por_pagar')
        .select('total_comision')
        .gte('fecha_pago', primerDia)
        .lte('fecha_pago', ultimoDia)
        .eq('estado', 'pagado');

      const comisionesPagadas = comisionesPagadasData?.reduce((sum, c) => sum + c.total_comision, 0) || 0;

      const totalGastos = gastosOperativos + comisionesPagadas;

      // 5. Comisiones pendientes
      const { data: comisionesData } = await supabase
        .from('comisiones_por_pagar')
        .select('total_comision')
        .gte('periodo_inicio', primerDia)
        .lte('periodo_fin', ultimoDia)
        .eq('estado', 'pendiente');

      const comisionesPendientes = comisionesData?.reduce((sum, c) => sum + c.total_comision, 0) || 0;

      const totalIngresos = ingresosConsultas + ingresosMoviles + ingresosAdicionales;
      const utilidad = totalIngresos - totalGastos;
      const ingresosSinGastosOperativos = totalIngresos - gastosOperativos;

      console.log('📊 Totales calculados:', {
        ingresosConsultas,
        ingresosMoviles,
        ingresosAdicionales,
        totalIngresos,
        totalGastos,
        gastosOperativos,
        comisionesPendientes,
        utilidad,
        ingresosSinGastosOperativos
      });

      setTotales({
        ingresos: totalIngresos,
        gastos: totalGastos,
        gastosOperativos: gastosOperativos,
        comisionesPagadas: comisionesPagadas,
        utilidad: utilidad,
        ingresosSinGastosOperativos: ingresosSinGastosOperativos,
        ingresosConsultas: ingresosConsultas,
        ingresosMoviles: ingresosMoviles,
        ingresosAdicionales: ingresosAdicionales,
        comisionesPendientes: comisionesPendientes
      });

    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (vistaActual === 'gastos') {
    return <GastosPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'ingresos') {
    return <IngresosPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'proveedores') {
    return <ProveedoresContabilidadPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'reportes') {
    return <ReportesFinancierosPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'comisiones') {
    return <ComisionesPagarPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'estadisticas') {
    return <EstadisticasPage onBack={() => setVistaActual('dashboard')} />;
  }

  // Vista Dashboard
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#064e3b 50%,#065f46 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-5 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Dashboard
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <DollarSign size={24} className="text-emerald-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Contabilidad</h1>
                <p className="text-emerald-300 text-sm mt-0.5">Gestión financiera y reportes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 flex items-center gap-3">
                <Calendar size={14} className="text-emerald-300" />
                <select className="bg-transparent text-white text-sm font-bold border-none outline-none cursor-pointer"
                  value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {meses.map((m, idx) => (<option key={idx} value={idx + 1} className="text-slate-800">{m}</option>))}
                </select>
                <select className="bg-transparent text-white text-sm font-bold border-none outline-none cursor-pointer"
                  value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                  {[2024, 2025, 2026, 2027].map(a => (<option key={a} value={a} className="text-slate-800">{a}</option>))}
                </select>
              </div>
              <button onClick={cargarDatos} disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ingresos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-emerald-50 rounded-xl p-2"><TrendingUp size={16} className="text-emerald-600" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingresos</span>
            </div>
            <p className="text-2xl font-black text-emerald-600">Q {totales.ingresos.toLocaleString('es-GT', {minimumFractionDigits:2})}</p>
            <div className="mt-3 space-y-1 border-t border-slate-50 pt-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Regulares</span><span className="font-semibold">Q {totales.ingresosConsultas.toLocaleString('es-GT', {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-xs text-orange-500">
                <span>📱 Móviles</span><span className="font-bold">Q {totales.ingresosMoviles.toLocaleString('es-GT', {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Otros</span><span className="font-semibold">Q {totales.ingresosAdicionales.toLocaleString('es-GT', {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          {/* Gastos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-50 rounded-xl p-2"><TrendingDown size={16} className="text-red-500" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastos</span>
            </div>
            <p className="text-2xl font-black text-red-600">Q {totales.gastos.toLocaleString('es-GT', {minimumFractionDigits:2})}</p>
            <div className="mt-3 space-y-1 border-t border-slate-50 pt-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Operativos</span><span className="font-semibold">Q {totales.gastosOperativos.toLocaleString('es-GT', {minimumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Comisiones</span><span className="font-semibold">Q {totales.comisionesPagadas.toLocaleString('es-GT', {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          {/* Comisiones Pendientes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-violet-50 rounded-xl p-2"><Clock size={16} className="text-violet-600" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comisiones</span>
            </div>
            <p className="text-2xl font-black text-violet-600">Q {totales.comisionesPendientes.toLocaleString('es-GT', {minimumFractionDigits:2})}</p>
            <p className="text-xs text-slate-400 mt-2">Pendientes de pago</p>
          </div>

          {/* Utilidad */}
          <div className={`rounded-2xl shadow-sm p-5 text-white ${totales.utilidad >= 0 ? '' : ''}`}
            style={{background: totales.utilidad >= 0 ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'linear-gradient(135deg,#dc2626,#e11d48)'}}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white/20 rounded-xl p-2">
                <DollarSign size={16} className="text-white" />
              </div>
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Utilidad</span>
            </div>
            <p className="text-2xl font-black">Q {totales.utilidad.toLocaleString('es-GT', {minimumFractionDigits:2})}</p>
            <p className="text-xs text-white/60 mt-2">
              Margen: {totales.ingresos > 0 ? ((totales.utilidad / totales.ingresos) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        {/* ── Resumen ventas del día ── */}
        <ResumenVentasDelDia mes={mes} anio={anio} />

        {/* ── Desglose móviles (colapsable) ── */}
        {totales.ingresosMoviles > 0 && (
          <div>
            <button onClick={() => setDesgloseExpandido(!desgloseExpandido)}
              className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left hover:shadow-md transition-all group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-50 rounded-xl p-2.5 text-xl">📱</div>
                  <div>
                    <p className="font-black text-slate-800 text-sm">Desglose de Ingresos</p>
                    <p className="text-xs text-slate-400">Ver detalle de servicios móviles</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Servicios Móviles</p>
                    <p className="text-lg font-black text-orange-600">Q {totales.ingresosMoviles.toLocaleString('es-GT', {minimumFractionDigits:2})}</p>
                    <p className="text-xs text-orange-400">{totales.ingresos > 0 ? ((totales.ingresosMoviles / totales.ingresos) * 100).toFixed(1) : 0}% del total</p>
                  </div>
                  <div className={`transform transition-transform text-slate-400 ${desgloseExpandido ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
            {desgloseExpandido && (
              <div className="mt-3 bg-orange-50 border border-orange-100 rounded-2xl p-5">
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Consultas Regulares', val: totales.ingresosConsultas, pct: totales.ingresos > 0 ? ((totales.ingresosConsultas/totales.ingresos)*100).toFixed(1) : '0', color: 'text-emerald-600', border: '' },
                    { label: '📱 Servicios Móviles', val: totales.ingresosMoviles,  pct: totales.ingresos > 0 ? ((totales.ingresosMoviles/totales.ingresos)*100).toFixed(1) : '0',  color: 'text-orange-600', border: 'border-2 border-orange-300' },
                    { label: 'Otros Ingresos',      val: totales.ingresosAdicionales, pct: totales.ingresos > 0 ? ((totales.ingresosAdicionales/totales.ingresos)*100).toFixed(1) : '0', color: 'text-blue-600', border: '' },
                  ].map((item, i) => (
                    <div key={i} className={`bg-white rounded-xl p-4 shadow-sm ${item.border}`}>
                      <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                      <p className={`text-xl font-black ${item.color}`}>Q {item.val.toLocaleString('es-GT', {minimumFractionDigits:2})}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.pct}%</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 text-xs text-orange-700 bg-white/70 p-3 rounded-xl">
                  <span className="shrink-0">ℹ️</span>
                  <span>Los servicios móviles SÍ cuentan como ingresos, pero NO generan comisiones para médicos referentes.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Accesos Rápidos ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { vista: 'ingresos',    label: 'Registrar Ingreso', desc: 'Ingresos adicionales', icon: TrendingUp,  grad: 'from-emerald-600 to-teal-600',  shadow: 'shadow-emerald-200' },
            { vista: 'gastos',      label: 'Registrar Gasto',   desc: 'Gastos operativos',   icon: TrendingDown, grad: 'from-red-500 to-rose-500',       shadow: 'shadow-red-200'     },
            { vista: 'comisiones',  label: 'Comisiones',        desc: 'Cuentas por pagar',   icon: Clock,        grad: 'from-violet-600 to-purple-600',  shadow: 'shadow-violet-200'  },
            { vista: 'estadisticas',label: 'Estadísticas',      desc: 'Análisis de estudios',icon: BarChart3,    grad: 'from-indigo-600 to-blue-600',    shadow: 'shadow-indigo-200'  },
            { vista: 'reportes',    label: 'Reportes',          desc: 'Estados financieros', icon: FileText,     grad: 'from-blue-600 to-cyan-600',      shadow: 'shadow-blue-200'    },
            { vista: 'proveedores', label: 'Proveedores',       desc: 'Catálogo',            icon: Users,        grad: 'from-amber-500 to-orange-500',   shadow: 'shadow-amber-200'   },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button key={item.vista} onClick={() => setVistaActual(item.vista as any)}
                className={`bg-gradient-to-br ${item.grad} text-white rounded-2xl p-4 text-left shadow-lg ${item.shadow} hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden`}>
                <div className="absolute -right-2 -bottom-2 opacity-10"><Icon size={56} /></div>
                <div className="bg-white/20 rounded-xl p-2 w-fit mb-2.5 border border-white/20">
                  <Icon size={16} className="text-white" />
                </div>
                <p className="font-black text-sm leading-tight">{item.label}</p>
                <p className="text-white/60 text-xs mt-0.5">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {/* ── Info ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-100 rounded-lg p-1.5"><Calendar size={13} className="text-blue-600" /></div>
            <span className="text-xs font-black text-blue-800 uppercase tracking-wide">Información</span>
          </div>
          <ul className="space-y-1.5">
            {[
              'Los ingresos por consultas regulares y móviles se calculan automáticamente',
              'Los servicios móviles se muestran separados para mejor control',
              'Puedes registrar ingresos adicionales (alquileres, otros servicios)',
              'Todos los gastos deben registrarse manualmente',
              'Las comisiones pendientes son obligaciones de pago a médicos referentes',
            ].map((txt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 shrink-0" />{txt}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

// COMPONENTE: Resumen de Ventas por Método (CON SERVICIOS MÓVILES)
interface ResumenVentasDelDiaProps {
  mes: number;
  anio: number;
}

const ResumenVentasDelDia: React.FC<ResumenVentasDelDiaProps> = ({ mes, anio }) => {
  const [loading, setLoading] = useState(false);
  const [ventasPorMetodo, setVentasPorMetodo] = useState<CuadrePorFormaPago[]>([]);
  const [ventasMovilesPorMetodo, setVentasMovilesPorMetodo] = useState<CuadrePorFormaPago[]>([]);
  const [gastosDelDia, setGastosDelDia] = useState(0);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
    const ahora = new Date();
    const guatemalaTime = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    const year = guatemalaTime.getFullYear();
    const month = String(guatemalaTime.getMonth() + 1).padStart(2, '0');
    const day = String(guatemalaTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
    cargarVentasDelDia();
  }, [fechaSeleccionada]);

  const cargarVentasDelDia = async () => {
    setLoading(true);
    try {
      // 1. Cargar consultas REGULARES del día
      const { data: consultas } = await supabase
        .from('consultas')
        .select(`
          forma_pago,
          detalle_consultas(precio)
        `)
        .eq('fecha', fechaSeleccionada)
        .or('anulado.is.null,anulado.eq.false')
        .or('es_servicio_movil.is.null,es_servicio_movil.eq.false');

      // 2. Cargar SERVICIOS MÓVILES del día
      const { data: consultasMoviles } = await supabase
        .from('consultas')
        .select(`
          forma_pago,
          detalle_consultas(precio)
        `)
        .eq('fecha', fechaSeleccionada)
        .or('anulado.is.null,anulado.eq.false')
        .eq('es_servicio_movil', true);

      // 3. Cargar gastos del día
      const { data: gastos } = await supabase
        .from('gastos')
        .select('monto')
        .eq('fecha', fechaSeleccionada);

      const totalGastos = gastos?.reduce((sum, g) => sum + g.monto, 0) || 0;
      setGastosDelDia(totalGastos);

      // 4. Procesar consultas REGULARES por forma de pago
      const cuadrePorForma: { [key: string]: CuadrePorFormaPago } = {};
      
      consultas?.forEach((consulta: any) => {
        const total = consulta.detalle_consultas?.reduce((sum: number, d: any) => sum + d.precio, 0) || 0;
        const formaPago = consulta.forma_pago;

        if (!cuadrePorForma[formaPago]) {
          cuadrePorForma[formaPago] = {
            forma_pago: formaPago,
            cantidad: 0,
            total: 0
          };
        }

        cuadrePorForma[formaPago].cantidad += 1;
        cuadrePorForma[formaPago].total += total;
      });

      // 5. Procesar SERVICIOS MÓVILES por forma de pago (POR SEPARADO)
      const cuadreMovilesPorForma: { [key: string]: CuadrePorFormaPago } = {};
      
      consultasMoviles?.forEach((consulta: any) => {
        const total = consulta.detalle_consultas?.reduce((sum: number, d: any) => sum + d.precio, 0) || 0;
        const formaPago = consulta.forma_pago || 'efectivo';

        if (!cuadreMovilesPorForma[formaPago]) {
          cuadreMovilesPorForma[formaPago] = {
            forma_pago: formaPago,
            cantidad: 0,
            total: 0
          };
        }

        cuadreMovilesPorForma[formaPago].cantidad += 1;
        cuadreMovilesPorForma[formaPago].total += total;
      });

      setVentasPorMetodo(Object.values(cuadrePorForma));
      setVentasMovilesPorMetodo(Object.values(cuadreMovilesPorForma));

    } catch (error) {
      console.error('Error al cargar ventas:', error);
    }
    setLoading(false);
  };

  const getFormaPagoNombre = (forma: string) => {
    const formas: any = {
      efectivo: 'EFECTIVO',
      tarjeta: 'TARJETA',
      transferencia: 'TRANSFERENCIA',
      efectivo_facturado: 'DEPÓSITO',
      estado_cuenta: 'ESTADO DE CUENTA',
      multiple: 'Múltiple'
    };
    return formas[forma] || forma;
  };

  // Calcular totales generales
  const totalGeneral = ventasPorMetodo.reduce((sum, m) => sum + m.total, 0);
  const totalConsultas = ventasPorMetodo.reduce((sum, m) => sum + m.cantidad, 0);
  const totalMoviles = ventasMovilesPorMetodo.reduce((sum, m) => sum + m.total, 0);
  const totalServiciosMoviles = ventasMovilesPorMetodo.reduce((sum, m) => sum + m.cantidad, 0);
  const totalNeto = totalGeneral + totalMoviles - gastosDelDia;

  return (
    <div className="mb-8">
      <div className="grid md:grid-cols-5 gap-4">
        {/* Tarjeta Principal: Total del Día */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-4 text-white hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <h3 className="font-semibold text-xs">Ventas del Día</h3>
            </div>
            <input
              type="date"
              className="px-2 py-1 border border-indigo-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-white"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
            />
          </div>
          
          {loading ? (
            <div className="text-center py-3">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold mb-1">
                Q {(totalGeneral + totalMoviles).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-indigo-100 text-xs mb-2">
                {totalConsultas + totalServiciosMoviles} servicio{(totalConsultas + totalServiciosMoviles) !== 1 ? 's' : ''} total
              </p>
              
              {totalMoviles > 0 && (
                <div className="border-t border-indigo-400 pt-2 mb-2 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-200">Consultas regulares</span>
                    <span className="font-semibold">Q {totalGeneral.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-200">Servicios móviles 📱</span>
                    <span className="font-semibold text-orange-200">Q {totalMoviles.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
              
              {gastosDelDia > 0 && (
                <div className="border-t border-indigo-400 pt-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-indigo-200">Gastos del día</span>
                    <span className="text-sm font-semibold text-red-200">
                      - Q {gastosDelDia.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-indigo-400">
                    <span className="text-xs text-indigo-200">Total Neto</span>
                    <span className={`text-lg font-bold ${totalNeto >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                      Q {totalNeto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tarjetas de Métodos de Pago */}
        {loading ? (
          <div className="col-span-4 flex items-center justify-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : ventasPorMetodo.length === 0 && ventasMovilesPorMetodo.length === 0 ? (
          <div className="col-span-4 flex items-center justify-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-sm">No hay ventas registradas en esta fecha</p>
          </div>
        ) : (
          <>
            {/* Consultas Regulares */}
            {ventasPorMetodo.slice(0, 4).map(metodo => (
              <div key={metodo.forma_pago} className="bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow border-l-4 border-blue-500">
                <p className="text-gray-600 text-xs font-semibold mb-1 uppercase tracking-wide">
                  {getFormaPagoNombre(metodo.forma_pago)}
                </p>
                <p className="text-2xl font-bold text-blue-600 mb-0.5">
                  Q {metodo.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-gray-500 text-xs">
                  {metodo.cantidad} consulta{metodo.cantidad !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
            
            {/* Si hay más de 4 métodos regulares */}
            {ventasPorMetodo.length > 4 && (
              <>
                <div className="md:col-span-1"></div>
                {ventasPorMetodo.slice(4).map(metodo => (
                  <div key={metodo.forma_pago} className="bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow border-l-4 border-blue-500">
                    <p className="text-gray-600 text-xs font-semibold mb-1 uppercase tracking-wide">
                      {getFormaPagoNombre(metodo.forma_pago)}
                    </p>
                    <p className="text-2xl font-bold text-blue-600 mb-0.5">
                      Q {metodo.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {metodo.cantidad} consulta{metodo.cantidad !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </>
            )}

            {/* Tarjetas de Servicios Móviles */}
            {ventasMovilesPorMetodo.length > 0 && (
              <>
                <div className="col-span-5 mt-4">
                  <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                    📱 Servicios Móviles
                  </h3>
                </div>
                <div className="md:col-span-1"></div>
                {ventasMovilesPorMetodo.map(metodo => (
                  <div key={`movil-${metodo.forma_pago}`} className="bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow border-l-4 border-orange-500">
                    <p className="text-orange-600 text-xs font-semibold mb-1 uppercase tracking-wide flex items-center gap-1">
                      {getFormaPagoNombre(metodo.forma_pago)} 📱
                    </p>
                    <p className="text-2xl font-bold text-orange-600 mb-0.5">
                      Q {metodo.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {metodo.cantidad} servicio{metodo.cantidad !== 1 ? 's' : ''} móvil{metodo.cantidad !== 1 ? 'es' : ''}
                    </p>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};