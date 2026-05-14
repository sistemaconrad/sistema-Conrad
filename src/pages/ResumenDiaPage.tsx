import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Calendar, Users, DollarSign, TrendingUp, TrendingDown,
  Activity, Package, FileText, AlertCircle, CheckCircle, Edit, Trash2,
  PlusCircle, Shield, Clock, Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GenerarCodigosPanel } from '../components/GenerarCodigosPanel';
import { generarCuadreExcel } from '../utils/cuadre-excel-generator';
import { generarReporteGastosDiario } from '../utils/gastos-excel-generator';
import { PeriodosEspecialesPanel } from '../components/PeriodosEspecialesPanel';

interface ResumenDiaPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

interface ResumenDatos {
  pacientesNuevos: number;
  consultasRegulares: number;
  consultasMoviles: number;
  totalConsultas: number;
  ingresosConsultas: number;
  ingresosMoviles: number;
  totalIngresos: number;
  gastosDelDia: number;
  ingresoNeto: number;
  productosAgregados: number;
  productosEditados: number;
  productosEliminados: number;
  usuariosActivos: string[];
  accionesConAutorizacion: number;
  actividadReciente: any[];
}

export const ResumenDiaPage: React.FC<ResumenDiaPageProps> = ({ onBack, onNavigate }) => {

  const getGuatemalaTime = () => {
    const ahora = new Date();
    return new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  };

  const getFechaGuatemala = () => {
    const gt = getGuatemalaTime();
    const yyyy = gt.getFullYear();
    const mm = String(gt.getMonth() + 1).padStart(2, '0');
    const dd = String(gt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Si es antes de la 1:00 AM Guatemala, la fecha operativa es ayer
  const getFechaOperativa = () => {
    const gt = getGuatemalaTime();
    if (gt.getHours() < 1) {
      const ayer = new Date(gt);
      ayer.setDate(ayer.getDate() - 1);
      const yyyy = ayer.getFullYear();
      const mm = String(ayer.getMonth() + 1).padStart(2, '0');
      const dd = String(ayer.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return getFechaGuatemala();
  };

  const [fecha, setFecha] = useState(getFechaOperativa);
  const [resumen, setResumen] = useState<ResumenDatos>({
    pacientesNuevos: 0, consultasRegulares: 0, consultasMoviles: 0,
    totalConsultas: 0, ingresosConsultas: 0, ingresosMoviles: 0,
    totalIngresos: 0, gastosDelDia: 0, ingresoNeto: 0,
    productosAgregados: 0, productosEditados: 0, productosEliminados: 0,
    usuariosActivos: [], accionesConAutorizacion: 0, actividadReciente: []
  });
  const [loading, setLoading] = useState(false);
  const [descargandoGastos, setDescargandoGastos] = useState(false);

  // ── tabs: ahora incluye 'horarios' solo para admin ─────────────
  const rolUsuario = localStorage.getItem('rolUsuarioConrad');
  const esAdmin = rolUsuario === 'admin';
  const [tabActiva, setTabActiva] = useState<'resumen' | 'auditoria' | 'horarios'>('resumen');

  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [logDetalle, setLogDetalle] = useState<any | null>(null);
  const [mostrarTokens, setMostrarTokens] = useState(false);

  useEffect(() => { cargarResumen(); }, [fecha]);

  const cargarResumen = async () => {
    setLoading(true);
    try {
      const { data: consultas } = await supabase
        .from('consultas')
        .select(`*, pacientes(id), detalle_consultas(precio)`)
        .eq('fecha', fecha)
        .or('anulado.is.null,anulado.eq.false');

      const consultasRegulares = consultas?.filter(c => !c.es_servicio_movil) || [];
      const consultasMoviles   = consultas?.filter(c =>  c.es_servicio_movil) || [];
      const ingresosConsultas  = consultasRegulares.reduce((sum, c) => sum + c.detalle_consultas.reduce((s: number, d: any) => s + d.precio, 0), 0);
      const ingresosMoviles    = consultasMoviles.reduce((sum, c)   => sum + c.detalle_consultas.reduce((s: number, d: any) => s + d.precio, 0), 0);
      const pacientesIds = new Set(consultas?.map(c => c.paciente_id));

      const { data: gastos } = await supabase.from('gastos').select('monto').eq('fecha', fecha);
      const gastosDelDia = gastos?.reduce((sum, g) => sum + g.monto, 0) || 0;

      const inicioDiaUTC = new Date(fecha + 'T06:00:00.000Z');
      const finDiaUTC    = new Date(fecha + 'T06:00:00.000Z');
      finDiaUTC.setDate(finDiaUTC.getDate() + 1);

      const { data: logs } = await supabase
        .from('log_actividad').select('*')
        .gte('created_at', inicioDiaUTC.toISOString())
        .lt('created_at',  finDiaUTC.toISOString())
        .order('created_at', { ascending: false }).limit(200);

      const usuariosActivos        = [...new Set(logs?.map(l => l.nombre_usuario) || [])] as string[];
      const accionesConAutorizacion = logs?.filter(l => l.requirio_autorizacion).length || 0;
      const productosAgregados     = logs?.filter(l => l.modulo === 'inventario' && l.accion === 'crear').length   || 0;
      const productosEditados      = logs?.filter(l => l.modulo === 'inventario' && l.accion === 'editar').length  || 0;
      const productosEliminados    = logs?.filter(l => l.modulo === 'inventario' && l.accion === 'eliminar').length|| 0;

      setResumen({
        pacientesNuevos: pacientesIds.size,
        consultasRegulares: consultasRegulares.length,
        consultasMoviles: consultasMoviles.length,
        totalConsultas: consultas?.length || 0,
        ingresosConsultas, ingresosMoviles,
        totalIngresos: ingresosConsultas + ingresosMoviles,
        gastosDelDia, ingresoNeto: (ingresosConsultas + ingresosMoviles) - gastosDelDia,
        productosAgregados, productosEditados, productosEliminados,
        usuariosActivos, accionesConAutorizacion, actividadReciente: logs || []
      });
    } catch (error) {
      console.error('Error al cargar resumen:', error);
      alert('Error al cargar resumen del día');
    } finally {
      setLoading(false);
    }
  };

  const descargarExcelCuadre = async () => {
    try {
      const { data: cuadreGuardado, error } = await supabase
        .from('cuadres_diarios').select('*').eq('fecha', fecha).maybeSingle();
      if (error) { alert('❌ Error al cargar cuadre guardado'); return; }
      if (!cuadreGuardado) { alert('⚠️ No hay cuadre guardado para esta fecha'); return; }

      const { data: consultas } = await supabase
        .from('consultas').select('*, detalle_consultas(precio)')
        .eq('fecha', fecha).or('anulado.is.null,anulado.eq.false');

      const cuadrePorForma: any = {};
      const consultasRegulares = consultas?.filter((c: any) => !c.es_servicio_movil) || [];
      const consultasMoviles   = consultas?.filter((c: any) =>  c.es_servicio_movil) || [];

      consultasRegulares.forEach((c: any) => {
        const total = c.detalle_consultas?.reduce((s: number, d: any) => s + d.precio, 0) || 0;
        const forma = c.forma_pago;
        if (!cuadrePorForma[forma]) cuadrePorForma[forma] = { forma_pago: forma, cantidad: 0, total: 0, es_servicio_movil: false };
        cuadrePorForma[forma].cantidad++; cuadrePorForma[forma].total += total;
      });
      consultasMoviles.forEach((c: any) => {
        const total = c.detalle_consultas?.reduce((s: number, d: any) => s + d.precio, 0) || 0;
        const key = `${c.forma_pago}_movil`;
        if (!cuadrePorForma[key]) cuadrePorForma[key] = { forma_pago: c.forma_pago, cantidad: 0, total: 0, es_servicio_movil: true };
        cuadrePorForma[key].cantidad++; cuadrePorForma[key].total += total;
      });

      const { data: gastosDia } = await supabase
        .from('gastos').select('*, categorias_gastos(nombre)').eq('fecha', fecha).order('created_at', { ascending: true });
      const totalGastos     = gastosDia?.reduce((s: number, g: any) => s + parseFloat(g.monto || 0), 0) || 0;
      const gastosParaExcel = (gastosDia || []).map((g: any) => ({
        concepto: g.concepto || '', monto: parseFloat(g.monto || 0),
        categoria: g.categorias_gastos?.nombre || g.categoria || '', created_at: g.created_at || ''
      }));

      const efectivoEsperado    = ((cuadrePorForma['efectivo']?.total || 0) + (cuadrePorForma['efectivo_movil']?.total || 0)) - totalGastos;
      const tarjetaEsperada     = (cuadrePorForma['tarjeta']?.total || 0) + (cuadrePorForma['tarjeta_movil']?.total || 0);
      const transferenciaEsperada = (cuadrePorForma['efectivo_facturado']?.total || 0) + (cuadrePorForma['transferencia']?.total || 0) + (cuadrePorForma['efectivo_facturado_movil']?.total || 0) + (cuadrePorForma['transferencia_movil']?.total || 0);
      const estadoCuentaEsperada  = (cuadrePorForma['estado_cuenta']?.total || 0) + (cuadrePorForma['estado_cuenta_movil']?.total || 0);

      const efectivoContado =
        (cuadreGuardado.efectivo_contado != null && cuadreGuardado.efectivo_contado > 0)
          ? parseFloat(cuadreGuardado.efectivo_contado)
          : ((cuadreGuardado.billetes_200||0)*200 + (cuadreGuardado.billetes_100||0)*100 +
             (cuadreGuardado.billetes_50 ||0)*50  + (cuadreGuardado.billetes_20 ||0)*20  +
             (cuadreGuardado.billetes_10 ||0)*10  + (cuadreGuardado.billetes_5  ||0)*5   +
             (cuadreGuardado.billetes_1  ||0)*1);

      const tarjetaContado       = parseFloat(cuadreGuardado.tarjeta_contado       || 0);
      const transferenciaContado = parseFloat(cuadreGuardado.transferencia_contado || 0);

      const diferencias = {
        efectivo:      efectivoContado      - efectivoEsperado,
        tarjeta:       tarjetaContado       - tarjetaEsperada,
        depositado:    transferenciaContado - transferenciaEsperada,
        estado_cuenta: 0
      };

      const cuadreCorrecto = Math.abs(diferencias.efectivo) < 0.01 && Math.abs(diferencias.tarjeta) < 0.01 && Math.abs(diferencias.depositado) < 0.01;
      const [yyyy, mm, dd] = fecha.split('-');
      const horaActual = getGuatemalaTime().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });

      await generarCuadreExcel({
        fecha: `${dd}/${mm}/${yyyy}`, horaActual,
        totalConsultas: consultas?.length || 0, totalVentas: resumen.totalIngresos,
        efectivoEsperado, efectivoContado, tarjetaEsperada, tarjetaContado,
        transferenciaEsperada, transferenciaContado, diferencias, cuadreCorrecto,
        observaciones: cuadreGuardado.observaciones, cajero: cuadreGuardado.nombre_cajero,
        cuadresPorFormaPago: Object.values(cuadrePorForma).map((c: any) => ({
          forma_pago: getFormaPagoNombre(c.forma_pago), cantidad: c.cantidad,
          total: c.total, es_servicio_movil: c.es_servicio_movil
        })),
        gastos: gastosParaExcel
      });
    } catch (error) {
      console.error('Error al descargar Excel:', error);
      alert('❌ Error al descargar Excel');
    }
  };

  const getFormaPagoNombre = (forma: string) => {
    const formas: any = {
      efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
      efectivo_facturado: 'Depósito', estado_cuenta: 'Estado de Cuenta'
    };
    return formas[forma] || forma;
  };

  const getIconoAccion = (accion: string) => {
    switch (accion.toLowerCase()) {
      case 'crear':    return <PlusCircle className="text-green-600" size={16} />;
      case 'editar':   return <Edit       className="text-blue-600"  size={16} />;
      case 'eliminar': return <Trash2     className="text-red-600"   size={16} />;
      default:         return <Activity   className="text-gray-600"  size={16} />;
    }
  };

  const getColorModulo = (modulo: string) => {
    const colores: { [key: string]: string } = {
      'sanatorio': 'bg-blue-100 text-blue-700', 'inventario': 'bg-green-100 text-green-700',
      'contabilidad': 'bg-purple-100 text-purple-700', 'personal': 'bg-orange-100 text-orange-700',
      'doctores': 'bg-indigo-100 text-indigo-700', 'sistema': 'bg-gray-100 text-gray-700'
    };
    return colores[modulo] || 'bg-gray-100 text-gray-700';
  };

  const logsAuditoria  = resumen.actividadReciente;
  const logsFiltrados  = logsAuditoria.filter(l => {
    const u = !filtroUsuario || l.nombre_usuario?.toLowerCase().includes(filtroUsuario.toLowerCase());
    const m = !filtroModulo  || l.modulo === filtroModulo;
    const a = !filtroAccion  || l.accion?.toLowerCase().includes(filtroAccion.toLowerCase());
    const t = mostrarTokens  || (l.tipo_registro !== 'token_autorizacion' && l.tipo_registro !== 'autorizacion');
    return u && m && a && t;
  });

  const tabs = [
    { id: 'resumen'   as const, label: 'Resumen del Día', icon: Activity  },
    { id: 'auditoria' as const, label: 'Auditoría',       icon: Shield    },
    ...(esAdmin ? [{ id: 'horarios' as const, label: 'Horarios / Feriados', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)' }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-indigo-300 hover:text-white mb-5 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Dashboard
          </button>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <Calendar size={24} className="text-indigo-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Resumen del Día</h1>
                <p className="text-indigo-300 text-sm mt-0.5">Panel de actividades, movimientos y auditoría</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-300" />
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="bg-transparent text-white font-bold text-sm border-none outline-none cursor-pointer" />
              </div>
              <button onClick={descargarExcelCuadre}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30">
                <FileText size={14} /> Descargar Excel
              </button>
              <button
                onClick={async () => {
                  setDescargandoGastos(true);
                  try { await generarReporteGastosDiario(fecha); }
                  catch { alert('Error al generar reporte de gastos'); }
                  finally { setDescargandoGastos(false); }
                }}
                disabled={descargandoGastos}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-900/30 disabled:opacity-50">
                <FileText size={14} /> {descargandoGastos ? 'Generando...' : 'Gastos del Día'}
              </button>
              {esAdmin && (
                <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-3 py-2" title="Contraseña para desproteger el Excel">
                  <Shield size={12} className="text-yellow-300 shrink-0" />
                  <span className="text-xs text-white/60 font-medium">Excel:</span>
                  <span className="text-xs text-yellow-300 font-bold tracking-wide">Conrad2024!</span>
                </div>
              )}
              {esAdmin && onNavigate && (
                <button onClick={() => onNavigate('usuarios')}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
                  <Shield size={14} /> Usuarios
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1 mt-6 border-b border-white/10">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setTabActiva(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2 ${
                    tabActiva === tab.id
                      ? 'text-white border-indigo-400 bg-white/10'
                      : 'text-indigo-300 border-transparent hover:text-white hover:bg-white/5'
                  }`}>
                  <Icon size={15} /> {tab.label}
                  {tab.id === 'auditoria' && logsAuditoria.length > 0 && (
                    <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full font-black">{logsAuditoria.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tabActiva === 'horarios' && (
          <div className="max-w-3xl"><PeriodosEspecialesPanel /></div>
        )}
        {tabActiva !== 'horarios' && loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
            <p className="text-sm text-slate-400 font-medium">Cargando datos...</p>
          </div>
        )}
        {tabActiva === 'resumen' && !loading && (
          <div className="space-y-6">
            <GenerarCodigosPanel />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-50 rounded-xl p-2"><Users size={16} className="text-blue-600" /></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regulares</span>
                </div>
                <p className="text-3xl font-black text-slate-900">{resumen.consultasRegulares}</p>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp size={13} className="text-blue-500" />
                  <p className="text-sm text-blue-600 font-bold">Q {resumen.ingresosConsultas.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-emerald-50 rounded-xl p-2"><Activity size={16} className="text-emerald-600" /></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Móviles</span>
                </div>
                <p className="text-3xl font-black text-slate-900">{resumen.consultasMoviles}</p>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp size={13} className="text-emerald-500" />
                  <p className="text-sm text-emerald-600 font-bold">Q {resumen.ingresosMoviles.toFixed(2)}</p>
                </div>
              </div>
              <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-white/20 rounded-xl p-2"><DollarSign size={16} className="text-white" /></div>
                  <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Total</span>
                </div>
                <p className="text-3xl font-black">Q {resumen.totalIngresos.toFixed(2)}</p>
                <p className="text-sm text-indigo-200 mt-2 font-medium">{resumen.totalConsultas} consultas totales</p>
              </div>
              <div className="rounded-2xl p-5 text-white shadow-lg"
                style={{ background: resumen.ingresoNeto >= 0 ? 'linear-gradient(135deg,#059669,#0d9488)' : 'linear-gradient(135deg,#dc2626,#e11d48)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-white/20 rounded-xl p-2">
                    {resumen.ingresoNeto >= 0 ? <TrendingUp size={16} className="text-white" /> : <TrendingDown size={16} className="text-white" />}
                  </div>
                  <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Neto</span>
                </div>
                <p className="text-3xl font-black">Q {resumen.ingresoNeto.toFixed(2)}</p>
                <p className="text-sm text-white/70 mt-2 font-medium">Gastos: Q {resumen.gastosDelDia.toFixed(2)}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                  <div className="bg-indigo-50 rounded-lg p-1.5"><Users size={14} className="text-indigo-600" /></div>
                  <span className="text-sm font-black text-slate-800">Pacientes</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-slate-500">Nuevos registrados</span>
                    <span className="text-lg font-black text-indigo-600">{resumen.pacientesNuevos}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-50">
                    <span className="text-sm text-slate-500">Total atendidos</span>
                    <span className="text-lg font-black text-slate-800">{resumen.totalConsultas}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                  <div className="bg-emerald-50 rounded-lg p-1.5"><Package size={14} className="text-emerald-600" /></div>
                  <span className="text-sm font-black text-slate-800">Inventario</span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { icon: <PlusCircle size={13} className="text-emerald-500" />, label: 'Agregados',  val: resumen.productosAgregados,  color: 'text-emerald-600' },
                    { icon: <Edit       size={13} className="text-blue-500"    />, label: 'Editados',   val: resumen.productosEditados,   color: 'text-blue-600'   },
                    { icon: <Trash2     size={13} className="text-red-500"     />, label: 'Eliminados', val: resumen.productosEliminados, color: 'text-red-600'    },
                  ].map((row, i) => (
                    <div key={i} className={`flex justify-between items-center py-1 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <span className="text-sm text-slate-500 flex items-center gap-1.5">{row.icon}{row.label}</span>
                      <span className={`text-lg font-black ${row.color}`}>{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                  <div className="bg-orange-50 rounded-lg p-1.5"><Shield size={14} className="text-orange-600" /></div>
                  <span className="text-sm font-black text-slate-800">Seguridad</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-slate-500">Usuarios activos</span>
                    <span className="text-lg font-black text-orange-600">{resumen.usuariosActivos.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-50">
                    <span className="text-sm text-slate-500">Con autorización</span>
                    <span className="text-lg font-black text-slate-800">{resumen.accionesConAutorizacion}</span>
                  </div>
                </div>
                {resumen.usuariosActivos.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                    {resumen.usuariosActivos.map((u, i) => (
                      <span key={i} className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg text-xs font-bold">{u}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-slate-100 rounded-lg p-1.5"><Activity size={14} className="text-slate-600" /></div>
                  <span className="text-sm font-black text-slate-800">Actividad Reciente</span>
                </div>
                <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-lg">Últimas {resumen.actividadReciente.length} acciones</span>
              </div>
              <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-50">
                {resumen.actividadReciente.length === 0 ? (
                  <div className="py-12 text-center">
                    <Activity size={36} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm text-slate-400">Sin actividad registrada</p>
                  </div>
                ) : resumen.actividadReciente.map((log, idx) => (
                  <div key={idx} className="px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setLogDetalle(log)}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{getIconoAccion(log.accion)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-black text-slate-900">{log.nombre_usuario}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getColorModulo(log.modulo)}`}>{log.modulo}</span>
                          {log.requirio_autorizacion && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-bold flex items-center gap-1">
                              <Shield size={10} /> Autorizado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold capitalize">{log.accion}</span>
                          {' — '}{log.tipo_registro}
                          {log.detalles?.descripcion && <span className="text-slate-400"> · {log.detalles.descripcion}</span>}
                        </p>
                        {log.detalles && Object.keys(log.detalles).filter(k => k !== 'descripcion').length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Object.entries(log.detalles).filter(([k]) => k !== 'descripcion').slice(0, 4).map(([k, v]) => (
                              <span key={k} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                                {k}: {String(v).substring(0, 30)}{String(v).length > 30 ? '…' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 shrink-0 font-mono">
                        <Clock size={11} />{log.hora}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tabActiva === 'auditoria' && !loading && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-50 rounded-lg p-1.5"><Shield size={14} className="text-indigo-600" /></div>
                <span className="text-sm font-black text-slate-800">Filtrar registros</span>
                <div className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                    <input type="checkbox" checked={mostrarTokens} onChange={e => setMostrarTokens(e.target.checked)} className="rounded" />
                    Mostrar autorizaciones con token
                  </label>
                  {(filtroUsuario || filtroModulo || filtroAccion) && (
                    <button onClick={() => { setFiltroUsuario(''); setFiltroModulo(''); setFiltroAccion(''); }}
                      className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                      <AlertCircle size={12} /> Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Usuario</label>
                  <input type="text" placeholder="Buscar usuario..." value={filtroUsuario}
                    onChange={e => setFiltroUsuario(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Módulo</label>
                  <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white">
                    <option value="">Todos</option>
                    {['sanatorio','inventario','contabilidad','personal','doctores','sistema'].map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Acción</label>
                  <input type="text" placeholder="crear, editar, eliminar..." value={filtroAccion}
                    onChange={e => setFiltroAccion(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total registros',  val: logsAuditoria.length,                                                       color: 'text-slate-800',  bg: 'bg-slate-50'  },
                { label: 'Con autorización', val: logsAuditoria.filter(l => l.requirio_autorizacion).length,                  color: 'text-amber-700',  bg: 'bg-amber-50'  },
                { label: 'Eliminaciones',    val: logsAuditoria.filter(l => l.accion?.toLowerCase() === 'eliminar').length,   color: 'text-red-700',    bg: 'bg-red-50'    },
                { label: 'Usuarios únicos',  val: new Set(logsAuditoria.map(l => l.nombre_usuario)).size,                     color: 'text-indigo-700', bg: 'bg-indigo-50' },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} rounded-2xl p-4 border border-slate-100`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-black text-slate-800">
                  {logsFiltrados.length} registro{logsFiltrados.length !== 1 ? 's' : ''}
                  {logsFiltrados.length !== logsAuditoria.length && <span className="text-indigo-500"> (filtrado)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <button onClick={cargarResumen} className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-bold transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                    Recargar
                  </button>
                  <span className="text-xs text-slate-400">Clic en fila para ver detalles</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Hora','Usuario','Módulo','Acción','Tipo','Descripción','Auth'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logsFiltrados.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No hay registros con los filtros aplicados</td></tr>
                    ) : logsFiltrados.map((log, idx) => (
                      <tr key={idx} onClick={() => setLogDetalle(log)}
                        className={`cursor-pointer transition-colors hover:bg-indigo-50/50 ${log.accion?.toLowerCase() === 'eliminar' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          <span className="flex items-center gap-1"><Clock size={11} />{log.hora}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800">{log.nombre_usuario}</span>
                          {log.usuario && <span className="block text-xs text-slate-400 font-mono">{log.usuario}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getColorModulo(log.modulo)}`}>{log.modulo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">{getIconoAccion(log.accion)}<span className="font-semibold capitalize text-slate-700">{log.accion}</span></span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{log.tipo_registro}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{log.detalles?.descripcion || '—'}</td>
                        <td className="px-4 py-3">
                          {log.requirio_autorizacion
                            ? <span className="flex items-center gap-1 text-amber-600 font-bold text-xs"><CheckCircle size={12} />Sí</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {logDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setLogDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)' }}>
              <div className="flex items-center gap-3">
                <div className="bg-white/15 rounded-xl p-2"><FileText size={16} className="text-white" /></div>
                <div>
                  <p className="text-white font-black text-sm">Detalle del Registro</p>
                  <p className="text-indigo-200 text-xs">{logDetalle.hora} · {logDetalle.nombre_usuario}</p>
                </div>
              </div>
              <button onClick={() => setLogDetalle(null)} className="text-indigo-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Usuario', val: logDetalle.nombre_usuario },
                  { label: 'Login',   val: logDetalle.usuario        },
                  { label: 'Rol',     val: logDetalle.rol            },
                  { label: 'Módulo',  val: logDetalle.modulo         },
                  { label: 'Acción',  val: logDetalle.accion         },
                  { label: 'Tipo',    val: logDetalle.tipo_registro  },
                  { label: 'Hora',    val: logDetalle.hora           },
                  { label: 'Fecha',   val: logDetalle.fecha          },
                ].map((row, i) => row.val && (
                  <div key={i} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-0.5">{row.label}</p>
                    <p className="text-sm font-semibold text-slate-800">{row.val}</p>
                  </div>
                ))}
              </div>
              {logDetalle.requirio_autorizacion && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
                  <Shield size={16} className="text-amber-600" />
                  <div>
                    <p className="text-xs font-black text-amber-700">Requirió autorización</p>
                    {logDetalle.token_usado && <p className="text-xs text-amber-600 font-mono">Token: {logDetalle.token_usado}</p>}
                  </div>
                </div>
              )}
              {logDetalle.detalles && (
                <div className="space-y-3">
                  {logDetalle.detalles.antes && logDetalle.detalles.despues && (
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Cambios realizados</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                          <p className="text-xs font-black text-red-400 uppercase tracking-wide mb-2">← Antes</p>
                          {Object.entries(logDetalle.detalles.antes).map(([k, v]) => (
                            <div key={k} className="mb-1.5">
                              <p className="text-xs text-red-400 font-bold capitalize">{k}</p>
                              <p className="text-xs text-red-700 font-semibold break-words">{String(v) || '—'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <p className="text-xs font-black text-emerald-400 uppercase tracking-wide mb-2">→ Después</p>
                          {Object.entries(logDetalle.detalles.despues).map(([k, v]) => {
                            const cambiado = String(logDetalle.detalles.antes[k]) !== String(v);
                            return (
                              <div key={k} className="mb-1.5">
                                <p className="text-xs text-emerald-400 font-bold capitalize">{k}</p>
                                <p className={`text-xs font-semibold break-words ${cambiado ? 'text-emerald-700 font-black' : 'text-emerald-600'}`}>
                                  {String(v) || '—'} {cambiado && <span className="text-emerald-400">✓</span>}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  {logDetalle.detalles.precio_anterior !== undefined && (
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Cambio de precio</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                          <p className="text-xs text-red-400 font-bold mb-1">← Precio anterior</p>
                          <p className="text-xl font-black text-red-600">Q {Number(logDetalle.detalles.precio_anterior).toFixed(2)}</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                          <p className="text-xs text-emerald-400 font-bold mb-1">→ Precio nuevo</p>
                          <p className="text-xl font-black text-emerald-600">Q {Number(logDetalle.detalles.precio_nuevo).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!logDetalle.detalles.antes && logDetalle.detalles.precio_anterior === undefined && (
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Información adicional</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(logDetalle.detalles).filter(([k]) => k !== 'descripcion').map(([k, v]) => (
                          <div key={k} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs font-black text-slate-400 capitalize mb-0.5">{k.replace(/_/g,' ')}</p>
                            <p className="text-sm font-semibold text-slate-700 break-words">{String(v)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <details className="mt-1">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 font-semibold">Ver JSON completo</summary>
                    <pre className="mt-2 bg-slate-900 text-emerald-400 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
                      {JSON.stringify(logDetalle.detalles, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};